#!/usr/bin/env node
'use strict';
const TypeProcessor = require('os-types');

if (process.argv.length != 3) {
  console.log('Need to get a full JSON object as a single parameter');
  process.exit(1);
}

let fields = JSON.parse(process.argv[2]);
let tp = new TypeProcessor();
let output = tp.fieldsToModel(fields);

function handleErrors() {
  if (output.errors) {
    console.log('FAILED');
    if (output.errors.general) {
      for (var msg of output.errors.general) {
        console.log(' - '+msg);
      }
    }
    if (output.errors.perField) {
      for (var field in output.errors.perField) {
        console.log(field+':');
        for (var msg of output.errors.perField[field]) {
          console.log('\t'+msg)
        }

      }
    }
    process.exit(1);
  }

  console.log(JSON.stringify(output));
  process.exit(0);
}

if (output.promise) {
  output.promise.then(() => {
    handleErrors();
  })
} else {
  handleErrors();
}

