'use strict';

import {expect} from 'chai';
import TypeProcessor from './index';
import _ from 'lodash';
import JTS from 'jsontableschema';
var osTypes = require('./os-types.json');
var osTypeDescriptions = require('./os-type-descriptions.json');

describe('os-types', function() {
  var tp = new TypeProcessor();

  describe('getAllTypes', function () {
    it('should be an array of strings', function () {
      expect(tp.getAllTypes()).to.satisfy(isArrayOfStrings);

      function isArrayOfStrings(array) {
        return array.every(function (item) {
          return typeof item === 'string';
        });
      }
    });

    it('should contain `activity:generic:contract:code`', function () {
      expect(tp.getAllTypes()).to.include('activity:generic:contract:code');
    });
  });

  describe('autoComplete', function () {
    it('autocompletes the empty string', function () {
      var allPrefixes = _.uniq(_.map(tp.getAllTypes(), (typ) => {
        return typ.split(':')[0] + (_.includes(typ, ':') ? ':' : '');
      }));
      var complete = tp.autoComplete('');
      expect(_.keys(complete)).to.eql(allPrefixes);
      _.forEach(_.values(complete), (v) => {
        expect(v.displayName).to.be.ok;
        expect(v.description).to.be.ok;
      });
    });
    it('autocompletes a simple string', function () {
      var allPrefixes =
        _.uniq(
          _.map(
            _.filter(tp.getAllTypes(), (typ) => {
              return _.startsWith(typ, 'a');
            }), (typ) => {
              return typ.split(':')[0] + (_.includes(typ, ':') ? ':' : '');
            }));
      var complete = tp.autoComplete('a');
      expect(_.keys(complete)).to.eql(allPrefixes);
      _.forEach(_.values(complete), (v) => {
        expect(v.displayName).to.be.ok;
        expect(v.description).to.be.ok;
      });
    });
    it('autocompletes a simple : ending string', function () {
      var allPrefixes =
        _.uniq(
          _.map(
            _.filter(tp.getAllTypes(), (typ) => {
              return _.startsWith(typ, 'functional-classification:');
            }), (typ) => {
              return 'functional-classification:' + typ.split(':')[1] + (_.includes(typ, ':') ? ':' : '');
            }));
      var complete = tp.autoComplete('functional-classification:');
      expect(_.keys(complete)).to.eql(allPrefixes);
      _.forEach(_.values(complete), (v) => {
        expect(v.displayName).to.be.ok;
        expect(v.description).to.be.ok;
      });
    });
    it('autocompletes a complex non : ending string', function () {
      var complete = tp.autoComplete('functional-classification:co');
      expect(_.keys(complete))
        .to.eql(['functional-classification:cofog:']);
      _.forEach(_.values(complete), (v) => {
        expect(v.displayName).to.be.ok;
        expect(v.description).to.be.ok;
      });
    });
    it('autocompletes with leaves and non leaves', function () {
      var complete = tp.autoComplete('functional-classification:cofog:group:');
      expect(_.keys(complete))
        .to.eql(['functional-classification:cofog:group:code:',
        'functional-classification:cofog:group:description',
        'functional-classification:cofog:group:label']);
      _.forEach(_.values(complete), (v) => {
        expect(v.displayName).to.be.ok;
        expect(v.description).to.be.ok;
      });
    });
  });

  describe('fieldsToModel', function () {
    it('detects invalid objects', function () {
      var invalids = [null,
        5,
        {}
          [{}],
        [{title: 'moshe'}],
        [{type: 'activity:generic:contract:code'}],
        [{type: 'moshe', name: 'miko'}],
        ["arr"],
        [{type: 'activity:generic:contract:code', name: 'aaa', extra: 'bbb'}],
        [{type: 'activity:generic:contract:code', name: 'aaa', options: {'bbb': 1}}]
      ];
      invalids.forEach((s) => {
        expect(tp.fieldsToModel(s).errors).to.be.ok;
      });
    });
    it('returns non null for valid objects', function () {
      var valids = [
        [{type: 'activity:generic:contract:code', name: 'hello world'}],
        [{type: '', name: 'hello world'}],
        [{type: null, name: 'hello world'}]
      ];
      valids.forEach((s) => {
        expect(tp.fieldsToModel(s).schema).to.be.ok;
      });
    });
    it('slugifies correctly titles', function () {
      var title_pairs = [
        [['hello_world', 'hello_world']],
        [['hello-world', 'hello_world']],
        [['hello world', 'hello_world']],
        [['héllô₪wörld', 'hello_world']],
        [['שלום עולם', 'activity_generic_program_code']],
        [['שלום עולם', 'activity_generic_program_code'],
          ['אכלת פלפל', 'activity_generic_project_code'],
          ['שתה מיץ', 'activity_generic_contract_code']],
        [['שלום עולם', 'activity_generic_program_code'],
          ['activity_generic_program_code', 'activity_generic_program_code_2'],
          ['activity_generic_program_code_2', 'activity_generic_program_code_2_2']]
      ];
      var types = [
        'activity:generic:program:code',
        'activity:generic:project:code',
        'activity:generic:contract:code'
      ];
      title_pairs.forEach((titles) => {
        let s = [];
        for (let i = 0; i < titles.length; i++) {
          s.push({type: types[i], name: titles[i][0]});
        }
        var model = tp.fieldsToModel(s);
        expect(model).to.not.equal(null);
        var schema = model.schema;
        titles.forEach((pair) => {
          expect(schema.fields[pair[0]].slug).to.equal(pair[1]);
        });
      });
    });
    it('prevents correctly ducplicates', function () {
      var title_pairs = [
        [['אבא', 'activity_generic_program_code'],
          ['אמא', 'activity_generic_program_code_2'],
          ['במבה', 'activity_generic_program_code_3']]
      ];
      var types = [
        'activity:generic:program:code',
        'activity:generic:program:code',
        'activity:generic:program:code'
      ];
      title_pairs.forEach((titles) => {
        let s = [];
        for (let i = 0; i < titles.length; i++) {
          s.push({type: types[i], name: titles[i][0]});
        }
        var model = tp.fieldsToModel(s);
        expect(model).to.not.equal(null);
        var schema = model.schema;
        titles.forEach((pair) => {
          expect(schema.fields[pair[0]].slug).to.equal(pair[1]);
        });
      });
    });
    it('detects bad data samples and raises proper errors', function() {
      var cases = [
        ['value', {}, ['abcz'], true],
        ['value', {}, ['123', 'abcz'], true],
        ['value', {}, ['abcz', '123'], true],
        ['value', {}, ['123'], false],
        ['value', {}, ['12.3'], false],
        ['value', {}, ['12.3'], false],
        ['value', {}, ['12.3'], false],
        ['date:generic', {}, ['1978-12-31'], false],
        ['date:generic', {format:'%Y/%m/%d'}, ['1978-12-31'], true],
        ['date:generic', {format:'%Y/%m/%d'}, ['1978/12/31'], false],
        ['value', {}, ['1,234'], false],
        ['value', {}, ['1,234.56'], false],
        ['value', { groupChar:' ', decimalChar:','}, ['1 234,56'], false],
        ['', {}, ['100'], false],
      ];
      _.forEach(cases, (_case) => {
        var fields = [
          {
            name: 'dummy',
            type: _case[0],
            options: _case[1],
            data: _case[2]
          }
        ];
        var model = tp.fieldsToModel(fields);
        expect(model).to.be.ok;
        if ( _case[3] ) {
          expect(model.errors).to.be.ok;
          expect(model.errors.perField).to.be.ok;
          expect(model.errors.perField.dummy).to.be.ok;
          expect(model.errors.perField.dummy).to.match(/^Data cannot be cast to this type/);
        } else {
          if (model.errors) {
            console.log(model.errors);
            console.log(_case);
          }
          expect(model.errors).to.not.be.ok;
        }
      });
    });
    it('detects bad data samples and raises proper errors for multiple fields', function() {
      var cases = [
        ['value', {}, ['abcz'], true],
        ['value', {}, ['123', 'abcz'], true],
        ['value', {}, ['abcz', '123'], true],
        ['value', {}, ['123'], false],
        ['value', {}, ['12.3'], false],
        ['value', {}, ['12.3'], false],
        ['value', {}, ['12.3'], false],
        ['date:generic', {}, ['1978-12-31'], false],
        ['date:generic', {format:'%Y/%m/%d'}, ['1978-12-31'], true],
        ['date:generic', {format:'%Y/%m/%d'}, ['1978/12/31'], false],
        ['value', {}, ['1,234'], false],
        ['value', {}, ['1,234.56'], false],
        ['value', { groupChar:' ', decimalChar:','}, ['1 234,56'], false],
        ['', {}, ['100'], false],
      ];
      var fields = [
        {
          name: 'dummy1',
          type: 'value',
          options: {},
          data: ['123','fsdsd','456']
        },
        {
          name: 'dummy2',
          type: 'date:fiscal-year',
          options: {},
          data: ['2012','2013','xxx']
        }
      ];
      var model = tp.fieldsToModel(fields);
      expect(model).to.be.ok;
      expect(model.errors).to.be.ok;
      expect(model.errors.perField).to.be.ok;
      expect(model.errors.perField.dummy1).to.be.ok;
      expect(model.errors.perField.dummy1).to.match(/^Data cannot be cast to this type/);
      expect(model.errors.perField.dummy2).to.be.ok;
      expect(model.errors.perField.dummy2).to.match(/^Data cannot be cast to this type/);
    });
    it('creates correctly dimensions & measures', function () {
      var fields = _.map(tp.getAllTypes(), (type) => {
        var name = type.replace(/:/g, ' ');
        return {name, type};
      });
      var ret = tp.fieldsToModel(fields);
      expect(ret).to.not.equal(null);
      var model = ret.model;
      expect(model).to.be.ok;
      expect(model.dimensions).to.be.ok;
      expect(model.measures).to.be.ok;
      _.forEach(_.values(ret.schema.fields), (field) => {
        if (field.conceptType != 'value') {
          expect(model.dimensions[field.conceptType]).to.be.ok;
          var attr = model.dimensions[field.conceptType].attributes[field.slug];
          expect(attr).to.be.ok;
          expect(attr.source).to.equal(field.name);
          expect(attr.title).to.equal(field.title);
          expect(attr.resource).to.equal(field.resource);
        } else {
          expect(model.measures[field.name]).to.be.ok;
        }
      });
    });
    it('adds correctly labelfor and parent', function () {
      var fields = [
        {type: 'administrative-classification:generic:level1:code:part', name: 'lvl1-code'},
        {type: 'administrative-classification:generic:level1:label', name: 'lvl1-label'},
        {type: 'administrative-classification:generic:level2:code:part', name: 'lvl2-code'},
        {type: 'administrative-classification:generic:level2:label', name: 'lvl2-label'}
      ];
      var ret = tp.fieldsToModel(fields);
      expect(ret).to.not.equal(null);
      var model = ret.model;
      var schema = ret.schema.fields;
      expect(model).to.be.ok;
      expect(model.dimensions).to.be.ok;
      expect(model.dimensions['administrative-classification']
        .attributes[schema['lvl1-label'].slug].labelfor)
        .to.be.equal(schema['lvl1-code'].slug);
      expect(model.dimensions['administrative-classification']
        .attributes[schema['lvl2-label'].slug].labelfor)
        .to.be.equal(schema['lvl2-code'].slug);
      expect(model.dimensions['administrative-classification']
        .attributes[schema['lvl2-code'].slug].parent)
        .to.be.equal(schema['lvl1-code'].slug);
    });
    it('suggests correctly options for data types and measures', function () {
      var fields = [
        {type: 'value', name: 'measure'},
        {type: 'date:generic', name: 'transaction-date'},
      ];
      var ret = tp.fieldsToModel(fields);
      expect(ret).to.not.equal(null);
      var model = ret.model;
      expect(model).to.be.ok;
      var schema = ret.schema.fields;
      expect(schema).to.be.ok;
      expect(_.map(schema['measure'].options, 'name'))
        .to.be.eql([
        "decimalChar",
        "groupChar",
        "currency",
        "factor",
        "direction",
        "phase"
      ]);
      expect(_.map(schema['transaction-date'].options, 'name'))
        .to.be.eql([
        'format'
      ]);
      expect(schema['transaction-date'].options[0].transform('abc'))
        .to.be.equal('fmt:abc');
    });
    it('embeds correctly options in schema, measures and dimensions', function () {
      var fields = [
        {type: 'value', name: 'measure', options: {
          decimalChar: 'dc',
          groupChar: 'gc',
          currency: 'cur',
          factor: 12,
          direction: 'dir',
          phase: 'pha'
        }, resource: 'res1'},
        {type: 'date:generic', name: 'transaction_date', resource: 'res2', options: {
          format: '12345'
        }}
      ];
      var ret = tp.fieldsToModel(fields);
      expect(ret).to.not.equal(null);
      var model = ret.model;
      expect(model).to.be.ok;
      expect(model.measures.measure.currency).to.be.equal('cur');
      expect(model.measures.measure.factor).to.be.equal(12);
      expect(model.measures.measure.direction).to.be.equal('dir');
      expect(model.measures.measure.phase).to.be.equal('pha');
      expect(model.dimensions.date.attributes.transaction_date.resource).to.be.equal('res2');
      var schema = ret.schema;
      expect(schema).to.be.ok;
      expect(schema.fields.measure.decimalChar).to.be.equal('dc');
      expect(schema.fields.measure.groupChar).to.be.equal('gc');
      expect(schema.fields.measure.type).to.be.equal('number');
      expect(schema.fields.measure.format).to.be.equal('default');
      expect(schema.fields.transaction_date.type).to.be.equal('date');
      expect(schema.fields.transaction_date.format).to.be.equal('fmt:12345');
    });
    it('embeds correctly default values for options in measures', function () {
      var fields = [
          {type: 'value', name: 'measure', options: {
              decimalChar: 'dc',
              factor: 12
          }, resource: 'res1'},
          {type: 'date:generic', name: 'transaction_date', resource: 'res2', options: {
              format: '12345'
          }}
      ];
      var ret = tp.fieldsToModel(fields);
      expect(ret).to.not.equal(null);
      var model = ret.model;
      expect(model).to.be.ok;
      expect(model.measures.measure.currency).to.be.undefined;
      expect(model.measures.measure.direction).to.be.undefined;
      expect(model.measures.measure.phase).to.be.undefined;
      var schema = ret.schema;
      expect(schema).to.be.ok;
      expect(schema.fields.measure.groupChar).to.be.equal(',');;
    });
  });

  describe('os-types definition', function() {
    it('should contain only JTS valid types', function() {
      _.forEach(osTypes, function(osTypeValue, osType) {
        var dataType = null;
        _.forEach(JTS.types, function(JTSTypeValue, JTSType) {
          if (_.endsWith(JTSType, 'Type') ) {
            var JTSObj = new JTSTypeValue();
            if (JTSObj.name === osTypeValue.dataType) {
              dataType = osTypeValue.dataType;
            }
          }
        });
        expect(dataType).to.not.be.null;
      });
    });

    it('should have a description and name for all types', function() {
      _.forEach(osTypes, function(osTypeValue, osType) {
        var parts = osType.split(':');
        var prefix = ''
        for ( var i = 0 ; i < parts.length ; i++ ) {
          prefix += parts[i];
          if ( i != parts.length - 1 ) {
            prefix += ':';
          }
          var description = osTypeDescriptions[prefix];
          if (!description || !description.displayName || !description.description) {
            console.log('MISSING DESCRIPTION FOR '+prefix, description);
          }
          expect(description).to.be.ok;
          expect(description.displayName).to.be.ok;
          expect(description.description).to.be.ok;
        }
      });
    });

    it('should have a type and name for all descriptions', function() {
      _.forEach(osTypeDescriptions, function(osTypeDescription, osType) {
        var prefix = _.some(_.map(_.keys(osTypes), function(key) {
          return _.startsWith(key, osType);
        }));
        if (!prefix) {
          console.log('MISSING TYPE FOR', osType);
        }
        expect(prefix).to.be.true;
      });
    });

    it('should order correcly ', function () {
      var fields = [
        {type: 'administrative-classification:generic:level4:code:part', name: 'lvl4-code'},
        {type: 'administrative-classification:generic:level3:code:part', name: 'lvl3-code'},
        {type: 'administrative-classification:generic:level7:code:part', name: 'lvl7-code'},
        {type: 'administrative-classification:generic:level2:code:part', name: 'lvl2-code'},
        {type: 'administrative-classification:generic:level1:code:part', name: 'lvl1-code'},
        {type: 'administrative-classification:generic:level6:code:part', name: 'lvl6-code'},
        {type: 'administrative-classification:generic:level5:code:part', name: 'lvl5-code'}
      ];
      var ret = tp.fieldsToModel(fields);
      expect(ret).to.not.equal(null);
      var model = ret.model;
      var schema = ret.schema.fields;
      expect(model).to.be.ok;
      expect(model.dimensions).to.be.ok;
      expect(model.dimensions['administrative-classification'].primaryKey).to.eql([
        'lvl1_code',
        'lvl2_code',
        'lvl3_code',
        'lvl4_code',
        'lvl5_code',
        'lvl6_code',
        'lvl7_code'
      ])
    });

  });

});
