'use strict';

import {expect} from 'chai';
import TypeProcessor from './index';

describe('os-types', function() {
  var tp = new TypeProcessor();
  describe('getAllTypes', function() {
    it('should be an array of strings', function() {
      expect(tp.getAllTypes()).to.satisfy(isArrayOfStrings);

      function isArrayOfStrings(array) {
        return array.every(function(item) {
          return typeof item === 'string';
        });
      }
    });

    it('should contain `activity:generic:contract:code`', function() {
      expect(tp.getAllTypes()).to.include('activity:generic:contract:code');
    });
  });

  describe('fieldsToModel', function() {
    it('detect invalid objects', function() {
      var invalids = [null,
                      5,
                      {}
                      [{}],
                      [{title:'moshe'}],
                      [{type:'activity:generic:contract:code'}],
                      [{type:'moshe', title:'miko'}],
                      ["arr"],
                      [{type:'activity:generic:contract:code', title:'aaa', extra:'bbb'}]
                      ];
      invalids.forEach((s) => {
        expect(tp.fieldsToModel(s)).to.equal(null);
      });
    });
    it('returns non null for valid objects', function() {
      var valids = [
        [{type:'activity:generic:contract:code', title:'hello world'}]
      ];
      valids.forEach((s) => {
        expect(tp.fieldsToModel(s)).to.not.equal(null);
      });
    });
      it('slugifies correctly titles', function() {
          var title_pairs = [
              [['hello_world','hello_world']],
              [['hello-world','hello_world']],
              [['hello world','hello_world']],
              [['héllô₪wörld','hello_world']],
              [['שלום עולם','ctvty_gnrc_prgrm_cd']],
              [['שלום עולם','ctvty_gnrc_prgrm_cd'],['אכלת פלפל','ctvty_gnrc_prjct_cd'],['שתה מיץ','ctvty_gnrc_cntrct_cd']],
              [['שלום עולם','ctvty_gnrc_prgrm_cd'],
                  ['ctvty_gnrc_prgrm_cd','ctvty_gnrc_prgrm_cd_2'],
                  ['ctvty_gnrc_prgrm_cd_2','ctvty_gnrc_prgrm_cd_2_2']]
          ];
          var types = [
              'activity:generic:program:code',
              'activity:generic:project:code',
              'activity:generic:contract:code'
          ];
          title_pairs.forEach((titles) => {
              let s = [];
              for ( let i = 0 ; i < titles.length ; i++ ) {
                  s.push({type:types[i], title:titles[i][0]});
              }
              var schema = tp.fieldsToModel(s);
              expect(schema).to.not.equal(null);
              schema = schema.schema;
              titles.forEach((pair) => {
                  expect(schema[pair[0]].name).to.equal(pair[1]);
              });
          });
      });
  });
});
