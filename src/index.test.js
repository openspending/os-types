'use strict';

import {expect} from 'chai';
import TypeProcessor from './index';
import _ from 'lodash';

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

  describe('autoComplete', function() {
      it('autocompletes the empty string', function() {
          var allPrefixes = _.uniq(_.map(tp.getAllTypes(), (typ) => {
              return typ.split(':')[0]+(_.includes(typ,':') ? ':' : '');
          }));
          expect(tp.autoComplete('')).to.eql(allPrefixes);
      });
      it('autocompletes a simple string', function() {
          var allPrefixes =
              _.uniq(
                  _.map(
                      _.filter(tp.getAllTypes(), (typ) => {
                          return _.startsWith(typ,'a');
                      }), (typ) => {
                          return typ.split(':')[0]+(_.includes(typ,':') ? ':' : '');
          }));
          expect(tp.autoComplete('a')).to.eql(allPrefixes);
      });
      it('autocompletes a simple : ending string', function() {
          var allPrefixes =
              _.uniq(
                  _.map(
                      _.filter(tp.getAllTypes(), (typ) => {
                          return _.startsWith(typ,'functional-classification:');
                      }), (typ) => {
                          return typ.split(':')[1]+(_.includes(typ,':') ? ':' : '');
                      }));
          console.log(allPrefixes);
          expect(tp.autoComplete('functional-classification:')).to.eql(allPrefixes);
      });
      it('autocompletes a complex non : ending string', function() {
          expect(tp.autoComplete('functional-classification:co')).to.eql(['cofog:']);
      });
      it('autocompletes with leaves and non leaves', function() {
          expect(tp.autoComplete('functional-classification:cofog:group:'))
              .to.eql(['code:', 'description', 'label']);
      });
  });

  describe('fieldsToModel', function() {
	it('detects invalid objects', function() {
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
		  var model = tp.fieldsToModel(s);
		  expect(model).to.not.equal(null);
		  var schema = model.schema;
		  titles.forEach((pair) => {
			  expect(schema.fields[pair[0]].name).to.equal(pair[1]);
		  });
	  });
	});
	it('prevents correctly ducplicates', function() {
		var title_pairs = [
		  [['אבא','ctvty_gnrc_prgrm_cd'],
			  ['אמא','ctvty_gnrc_prgrm_cd_2'],
			  ['במבה','ctvty_gnrc_prgrm_cd_3']]
		];
		var types = [
		  'activity:generic:program:code',
		  'activity:generic:program:code',
		  'activity:generic:program:code'
		];
		title_pairs.forEach((titles) => {
		  let s = [];
		  for ( let i = 0 ; i < titles.length ; i++ ) {
			  s.push({type:types[i], title:titles[i][0]});
		  }
		  var model = tp.fieldsToModel(s);
		  expect(model).to.not.equal(null);
		  var schema = model.schema;
		  titles.forEach((pair) => {
			  expect(schema.fields[pair[0]].name).to.equal(pair[1]);
		  });
		});
	});
	it('creates correctly dimensions & measures', function() {
		var fields = _.map(tp.getAllTypes(), (type) => {
            var title = type.replace(/:/g,' ');
            return {title, type};
        });
        var ret = tp.fieldsToModel(fields);
        expect(ret).to.not.equal(null);
        var model = ret.model;
        expect(model).to.be.ok;
        expect(model.dimensions).to.be.ok;
        expect(model.measures).to.be.ok;
        _.forEach(_.values(ret.schema.fields), (field) => {
            if ( field.conceptType != 'value' ) {
                expect(model.dimensions[field.conceptType]).to.be.ok;
                var attr = model.dimensions[field.conceptType].attributes[field.name];
                expect(attr).to.be.ok;
                expect(attr.source).to.equal(field.name);
                expect(attr.title).to.equal(field.title);
                expect(attr.resource).to.equal(field.resource);
            } else {
                expect(model.measures[field.name]).to.be.ok;
            }
        });
	});
	it('adds correctly labelFor and parent', function() {
		var fields = [
            {type: 'administrative-classification:generic:level1:code:part', title: 'lvl1-code'},
            {type: 'administrative-classification:generic:level1:label', title: 'lvl1-label'},
            {type: 'administrative-classification:generic:level2:code:part', title: 'lvl2-code'},
            {type: 'administrative-classification:generic:level2:label', title: 'lvl2-label'}
        ];
        var ret = tp.fieldsToModel(fields);
        expect(ret).to.not.equal(null);
        var model = ret.model;
        var schema = ret.schema.fields;
        expect(model).to.be.ok;
        expect(model.dimensions).to.be.ok;
        expect(model.dimensions['administrative-classification']
                    .attributes[schema['lvl1-label'].name].labelFor)
                    .to.be.equal(schema['lvl1-code'].name);
        expect(model.dimensions['administrative-classification']
                    .attributes[schema['lvl2-label'].name].labelFor)
                    .to.be.equal(schema['lvl2-code'].name);
        expect(model.dimensions['administrative-classification']
                    .attributes[schema['lvl2-code'].name].parent)
                    .to.be.equal(schema['lvl1-code'].name);
	});
  });
});
