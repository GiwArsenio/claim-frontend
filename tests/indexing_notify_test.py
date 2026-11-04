import importlib.util,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('notify',Path(__file__).parents[1]/'tools/indexing-notify.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
URL='https://claimyourjob.com/fr/offre/actuaire'
class Response:
 def __init__(self,body,url=URL,status=200):self.body=body.encode();self.url=url;self.status=status;self.headers={'Content-Type':'text/html'}
 def __enter__(self):return self
 def __exit__(self,*args):pass
 def read(self):return self.body
class Notify(unittest.TestCase):
 def responses(self,missing=False):
  job={'@type':'JobPosting','title':'Actuaire','description':'Mission','datePosted':'2026-01-01','hiringOrganization':{'name':'AXA'},'jobLocation':{'address':{'addressCountry':'FR','addressLocality':'Paris'}},'directApply':False}
  if missing:del job['datePosted']
  html='<link rel="canonical" href="'+URL+'"><script type="application/ld+json">'+json.dumps(job)+'</script><h1>Actuaire</h1>'
  source={'title':'Actuaire','status':'active','slug':'actuaire','source_published_at':'2026-01-01','source_url':'https://example.com/job'}
  return [Response(html),Response(json.dumps(source))]
 def test_source_date_missing_blocks(self):
  with patch.object(m.urllib.request,'urlopen',side_effect=self.responses(True)):
   with self.assertRaisesRegex(ValueError,'datePosted'):m.check(URL)
 def test_source_date_mismatch_blocks(self):
  rs=self.responses();rs[1]=Response(json.dumps({'title':'Actuaire','status':'active','slug':'actuaire','source_published_at':None}))
  with patch.object(m.urllib.request,'urlopen',side_effect=rs):
   with self.assertRaisesRegex(ValueError,'Date source'):m.check(URL)
 def test_validated_against_source(self):
  with patch.object(m.urllib.request,'urlopen',side_effect=self.responses()):self.assertEqual(len(m.check(URL)),64)
 def test_noncanonical_url_rejected_before_request(self):
  with patch.object(m.urllib.request,'urlopen') as fetch:
   for url in ['https://claimyourjob.fr/offre/foo',URL+'?q=x','https://claimyourjob.com/fr/offres.html']:
    with self.assertRaises(ValueError):m.check(url)
   fetch.assert_not_called()
 def test_dryrun_never_publishes(self):
  import argparse
  with tempfile.TemporaryDirectory() as tmp,patch.object(m,'check',return_value='abc'),patch.object(m.urllib.request,'urlopen') as fetch:
   m.run(argparse.Namespace(urls=[URL],publish=False,state=tmp+'/state'));fetch.assert_not_called()
 def test_unchanged_skips_publication(self):
  import argparse
  with tempfile.TemporaryDirectory() as tmp,patch.object(m,'check',return_value='abc'),patch.object(m.urllib.request,'urlopen') as fetch:
   p=Path(tmp)/'state';p.write_text(json.dumps({'url':URL,'accepted':True,'fingerprint':'abc'})+'\n')
   m.run(argparse.Namespace(urls=[URL],publish=True,state=str(p)));fetch.assert_not_called()
 def test_lock_prevents_concurrency(self):
  import argparse
  with tempfile.TemporaryDirectory() as tmp:
   Path(tmp+'/state.lock').touch()
   with self.assertRaises(FileExistsError):m.run(argparse.Namespace(urls=[URL],publish=False,state=tmp+'/state'))
 def test_limit_blocks_mass_publication(self):
  import argparse
  with self.assertRaises(ValueError):m.run(argparse.Namespace(urls=[URL]*6,publish=True,state='unused'))
if __name__=='__main__':unittest.main()
