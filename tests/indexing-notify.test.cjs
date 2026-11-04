'use strict';
// Tests Python de l'outil Indexing intégrés à la suite obligatoire.
const {execFileSync}=require('node:child_process');
execFileSync('python3',['tests/indexing_notify_test.py'],{stdio:'inherit'});
