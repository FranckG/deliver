#!/usr/bin/env node
import * as fs from 'node:fs'
import { getProperties } from 'properties-file'
import * as https from 'https'
import { simpleGit } from 'simple-git';
import promptSync from 'prompt-sync';
import meow from 'meow'; // command line parser
import { execSync } from 'child_process';

function isEmpty(val){
  return (val === undefined || val == null || val.length <= 0) ? true : false
}

function downloadFile (url, file) {
  return new Promise((resolve, reject)=>{
    const request = https.get(url, function(response) {
      response.pipe(file);
      // after download completed close filestream
      file.on("finish", () => {
        file.close()
        resolve();
      })
    })
  })
}

const cli = meow(`
	Usage
	  $ deliver 
    -b --branch:    source branch [default: develop]
    -c --cascading: cascading is required [default: false]

	Examples
	  $ deliver -b sourceBranch -c
`, {
	importMeta: import.meta,
	flags: {
		branch: {
			type: 'string',
			shortFlag: 'b',
      default: 'develop'
		},
    cascading: {
      type: 'boolean',
      shortFlag: 'c',
      default: false
    }
	}
});

const fileName = 'targets.properties'
const file = fs.createWriteStream(fileName)
const url = 'https://raw.githubusercontent.com/FranckG/deliver/master/targets.properties'

await downloadFile(url, file)
const properties = getProperties(fileName)

for (let i=0; i < properties.collection.length; i++) {
  const property = properties.collection[i]
  if (!isEmpty(property.value)) { 
    console.log(`${i}: ${property.key}`)
  }
}

const prompt = promptSync();
let choice = prompt('Select a target: ')
choice = Number(choice)
const property = properties.collection[choice]

const git= simpleGit(process.cwd());
const sourceBranch = cli.flags.branch
const targetBranch = git.branch(['--show-current'])
const isCascadingRequested = cli.flags.cascading

await git.merge([sourceBranch])

if (isCascadingRequested) {
  await git.checkout(sourceBranch)
  git.merge(targetBranch)
}

/*
 * create tag
 */
const version = execSync('mvn -q --non-recursive --batch-mode -Dexpression=project.version -DforceStdout help:evaluate', { encoding: 'utf-8' });  // the default is 'buffer'
console.log(`Version: ${version}`)
await git.addAnnotatedTag (version, property.value)

/*
 * push to origin
 */
git.push('origin', version, targetBranch, sourceBranch)
