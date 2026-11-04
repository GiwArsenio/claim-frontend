#!/usr/bin/env python3
"""Notifications JobPosting v3, dry-run par défaut. Jeton OAuth indexing via env.
Pas de découverte massive : 1 à 5 URL explicitement fournies, journal persistant.
Une acceptation signifie notification reçue, jamais indexation garantie.
"""
import argparse,datetime as dt,hashlib,json,os,re,sys,urllib.request,urllib.error
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote, quote

class Page(HTMLParser):
    def __init__(self):
        super().__init__();self.canonical=[];self.blocks=[];self.current=None;self.noindex=False;self.visible=[];self.hidden=0
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='link' and a.get('rel')=='canonical':self.canonical.append(a.get('href'))
        if tag=='meta' and a.get('name','').lower() in ['robots','googlebot'] and 'noindex' in a.get('content','').lower():self.noindex=True
        if tag in ['script','style']:self.hidden+=1
        if tag=='script' and a.get('type')=='application/ld+json':self.current=''
    def handle_data(self,data):
        if self.current is not None:self.current+=data
        if not self.hidden:self.visible.append(data)
    def handle_endtag(self,tag):
        if tag=='script' and self.current is not None:
            self.blocks.append(json.loads(self.current));self.current=None
        if tag in ['script','style']:self.hidden=max(0,self.hidden-1)

def check(url):
    u=urlsplit(url)
    if u.scheme!='https' or u.netloc!='claimyourjob.com' or not u.path.startswith('/fr/offre/') or not u.path[10:] or u.query or u.fragment:raise ValueError('URL hors périmètre canonique fiches')
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'CLAIM-Indexing-Validator/1.0'}),timeout=30) as r:
        if r.status!=200 or r.url!=url:raise ValueError('Fiche non 200 ou redirigée')
        if 'text/html' not in r.headers.get('Content-Type','') or 'noindex' in r.headers.get('X-Robots-Tag','').lower():raise ValueError('Fiche non indexable')
        html=r.read().decode('utf-8')
    p=Page();p.feed(html)
    if p.noindex or p.canonical!=[url]:raise ValueError('noindex ou canonique différente')
    jobs=[]
    for b in p.blocks:
        if isinstance(b,dict):jobs.extend(b.get('@graph',[b]))
    jobs=[j for j in jobs if j.get('@type')=='JobPosting']
    if len(jobs)!=1:raise ValueError('JobPosting unique requis')
    j=jobs[0]
    for field in ['title','description','datePosted','hiringOrganization']:
        if not j.get(field):raise ValueError('Champ requis absent : '+field)
    if not j['hiringOrganization'].get('name'):raise ValueError('Employeur absent')
    # Vérifier la date contre la source API, jamais contre la collecte.
    slug=unquote(u.path[len('/fr/offre/'):])
    source_url='https://claim-api-production-06b3.up.railway.app/api/v1/jobs/'+quote(slug,safe='')
    with urllib.request.urlopen(source_url,timeout=30) as r:
        source=json.load(r)
    if source.get('status')!='active' or source.get('slug')!=slug:raise ValueError('Source inactive ou slug différent')
    source_date=source.get('source_published_at')
    if not source_date or j['datePosted']!=source_date[:10]:raise ValueError('Date source absente ou différente')
    if j['title']!=source.get('title'):raise ValueError('Titre différent de la source')
    if not source.get('source_url'):raise ValueError('Candidature source absente')
    publication=dt.date.fromisoformat(j['datePosted'])
    if publication>dt.date.today():raise ValueError('Publication future')
    if j.get('validThrough'):
        expiration=dt.datetime.fromisoformat(j['validThrough'].replace('Z','+00:00'))
        if expiration.tzinfo is None:expiration=expiration.replace(tzinfo=dt.timezone.utc)
        if expiration<=dt.datetime.now(dt.timezone.utc):raise ValueError('Offre expirée')
    loc=j.get('jobLocation',{});loc=loc[0] if isinstance(loc,list) and loc else loc
    if not loc.get('address',{}).get('addressCountry'):raise ValueError('Pays lieu absent')
    if not loc.get('address',{}).get('addressLocality'):raise ValueError('Localisation précise absente : revue humaine requise')
    if j.get('directApply') is True:raise ValueError('directApply non vérifié')
    if j['title'] not in ''.join(p.visible):raise ValueError('Titre non visible')
    # Empreinte du balisage, pas du document (scripts analytics changeants).
    return hashlib.sha256(json.dumps(j,sort_keys=True,ensure_ascii=False).encode()).hexdigest()

def run(args):
    if not 1<=len(args.urls)<=5:raise ValueError('Lot explicitement borné à 1–5 URL')
    state=Path(args.state);state.parent.mkdir(parents=True,exist_ok=True)
    # Verrou exclusif : une seconde exécution ne republie pas simultanément.
    lock=state.with_suffix(state.suffix+'.lock');fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
    try:
        previous={}
        if state.exists():
            for line in state.read_text().splitlines():
                item=json.loads(line)
                if item.get('accepted'):previous[item['url']]=item['fingerprint']
        accepted=0
        for url in dict.fromkeys(args.urls):
            try:fingerprint=check(url)
            except Exception as e:print(json.dumps({'url':url,'eligible':False,'reason':str(e)}));continue
            if previous.get(url)==fingerprint:print(json.dumps({'url':url,'skipped':'already accepted, unchanged'}));continue
            if not args.publish:print(json.dumps({'url':url,'eligible':True,'dry_run':True}));continue
            t=os.environ.get('GOOGLE_INDEXING_ACCESS_TOKEN')
            if not t:raise ValueError('GOOGLE_INDEXING_ACCESS_TOKEN requis (scope indexing, propriétaire vérifié)')
            request=urllib.request.Request('https://indexing.googleapis.com/v3/urlNotifications:publish',data=json.dumps({'url':url,'type':'URL_UPDATED'}).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+t})
            try:
                with urllib.request.urlopen(request,timeout=30) as r:body=json.load(r);http=r.status
            except urllib.error.HTTPError as e:
                print(json.dumps({'url':url,'accepted':False,'http':e.code}));break # arrêt sur droits/quota/API, pas de rafale
            ok=http==200 and body.get('urlNotificationMetadata',{}).get('url')==url
            item={'url':url,'fingerprint':fingerprint,'accepted':ok,'http':http,'at':dt.datetime.now(dt.timezone.utc).isoformat(),'notification':body.get('urlNotificationMetadata')}
            with state.open('a') as f:f.write(json.dumps(item)+'\n');f.flush();os.fsync(f.fileno())
            print(json.dumps(item));accepted+=int(ok)
            if not ok:break
        print(json.dumps({'accepted':accepted,'indexed':'not measured; notification is not indexing'}))
    finally:os.close(fd);lock.unlink(missing_ok=True)

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('urls',nargs='+');p.add_argument('--publish',action='store_true');p.add_argument('--state',default='.local/indexing-notifications.jsonl');args=p.parse_args()
    try:run(args)
    except Exception as e:sys.exit(str(e))
