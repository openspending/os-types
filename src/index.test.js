'use strict';

import {expect} from 'chai';
import TypeProcessor from './index';
import * as extraOptions from './extra-options'
import _ from 'lodash';
let Schema = require('jsontableschema').Schema;
let osTypes = require('./os-types.json');
let osTypeDescriptions = require('./os-type-descriptions.json');

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

    it('should contain `activity:generic:contract:code:part`', function () {
      expect(tp.getAllTypes()).to.include('activity:generic:contract:code:part');
    });
  });

  describe('autoComplete', function () {
    it('autocompletes the empty string', function () {
      var allPrefixes = _.uniq(_.map(tp.getAllTypes(), (typ) => {
        return typ.split(':')[0] + (_.includes(typ, ':') ? ':' : '');
      }));
      var complete = tp.autoComplete('');
      expect(_.map(complete, 'type')).to.have.members(allPrefixes);
      var group = null;
      _.forEach(complete, (v) => {
        if (group == null) {
          expect(v.group).to.be.ok;
          group = v.group;
        } else if (v.group) {
          expect(v.group).to.be.above(group);
          group = v.group;
        }
        expect(v.displayName).to.be.ok;
        expect(v.description).to.be.ok;
      });
    });
    it('autocompletes a simple string', function () {
      var allPrefixes =
        _.sortBy(
          _.uniq(
            _.map(
              _.filter(tp.getAllTypes(), (typ) => {
                return _.startsWith(typ, 'a');
              }), (typ) => {
                return typ.split(':')[0] + (_.includes(typ, ':') ? ':' : '');
              })));
      var complete = tp.autoComplete('a');
      expect(_.map(complete, 'type')).to.have.members(allPrefixes);
      _.forEach(complete, (v) => {
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
      expect(_.map(complete, 'type')).to.eql(allPrefixes);
      _.forEach(complete, (v) => {
        expect(v.displayName).to.be.ok;
        expect(v.description).to.be.ok;
      });
    });
    it('autocompletes a complex non : ending string', function () {
      var complete = tp.autoComplete('functional-classification:co');
      expect(_.map(complete, 'type'))
        .to.eql(['functional-classification:cofog:']);
      _.forEach(complete, (v) => {
        expect(v.displayName).to.be.ok;
        expect(v.description).to.be.ok;
      });
    });
    it('autocompletes with leaves and non leaves', function () {
      var complete = tp.autoComplete('functional-classification:cofog:group:');
      expect(_.map(complete, 'type'))
        .to.eql(['functional-classification:cofog:group:code:',
        'functional-classification:cofog:group:description',
        'functional-classification:cofog:group:label']);
      _.forEach(complete, (v) => {
        expect(v.displayName).to.be.ok;
        expect(v.description).to.be.ok;
      });
    });
  });

  describe('getDataTypeExtraOptions', function() {
    it('should get extra options', function() {
      expect(tp.getDataTypeExtraOptions('date:generic')).to.deep.equal(
        extraOptions.dataTypes.date.options
      )
    })
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
        [{type: 'activity:generic:contract:code', name: 'aaa', options: {'bbb': 1}}],
        [{type: 'activity:generic:project:code', name: 'aaa', data: ['a', 'b']}]
      ];
      invalids.forEach((s) => {
        expect(tp.fieldsToModel(s).errors).to.be.ok;
      });
    });
    it('returns non null for valid objects', function () {
      var valids = [
        [{type: 'activity:generic:contract:code:full', name: 'hello world'}],
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
          ['אכלת פלפל', 'activity_generic_project_code_part'],
          ['שתה מיץ', 'activity_generic_contract_code_part']],
        [['שלום עולם', 'activity_generic_program_code'],
          ['activity_generic_program_code', 'activity_generic_program_code_2'],
          ['activity_generic_program_code_2', 'activity_generic_program_code_2_2']]
      ];
      var types = [
        'activity:generic:program:code',
        'activity:generic:project:code:part',
        'activity:generic:contract:code:part'
      ];
      title_pairs.forEach((titles) => {
        let s = [];
        for (let i = 0; i < titles.length; i++) {
          s.push({type: types[i], name: titles[i][0], title: 'dummy-title-'+i });
        }
        var model = tp.fieldsToModel(s);
        expect(model).to.not.equal(null);
        var schema = model.schema;
        expect(schema).to.be.ok;
        titles.forEach((pair) => {
          expect(schema.fields[pair[0]].slug).to.equal(pair[1]);
        });
      });
    });
    it('prevents correctly duplicates', function () {
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
          },
          {
            name: 'dummy2',
            type: _case[0],
            options: _case[1],
            data: _case[2],
            description: 'dummy-description'
          }
        ];
        var model = tp.fieldsToModel(fields);
        expect(model).to.be.ok;
        if ( _case[3] ) {
          expect(model.promise).to.be.ok;
          model.promise.then(() => {
            expect(model.errors).to.be.ok;
            expect(model.errors.perField).to.be.ok;
            expect(model.errors.perField.dummy).to.be.ok;
            expect(model.errors.perField.dummy).to.match(/^Data cannot be cast to this type/);
          });
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
      expect(model.promise).to.be.ok;
      model.promise.then(() => {
        expect(model.errors).to.be.ok;
        expect(model.errors.perField).to.be.ok;
        expect(model.errors.perField.dummy1).to.be.ok;
        expect(model.errors.perField.dummy1).to.match(/^Data cannot be cast to this type/);
        expect(model.errors.perField.dummy2).to.be.ok;
        expect(model.errors.perField.dummy2).to.match(/^Data cannot be cast to this type/);
      });
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
        {type: 'administrative-classification:generic:level1:code', name: 'lvl1-code'},
        {type: 'administrative-classification:generic:level1:label', name: 'lvl1-label'},
        {type: 'administrative-classification:generic:level2:code:part', name: 'lvl2-code'},
        {type: 'administrative-classification:generic:level2:label', name: 'lvl2-label'},
        {type: 'administrative-classification:generic:level4:code:full', name: 'lvl4-code'},
        {type: 'administrative-classification:generic:level4:label', name: 'lvl4-label'}
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
      expect(model.dimensions['administrative-classification']
        .attributes[schema['lvl4-code'].slug].parent)
        .to.be.equal(schema['lvl2-code'].slug);
      expect(model.dimensions['administrative-classification']
        .attributes[schema['lvl4-label'].slug].labelfor)
        .to.be.equal(schema['lvl4-code'].slug);
    });
    it('detects missing labelfor relations', function () {
      var fields = [
        {type: 'administrative-classification:generic:level1:code', name: 'lvl1-code'},
        {type: 'administrative-classification:generic:level1:label', name: 'lvl1-label'},
        {type: 'administrative-classification:generic:level2:label', name: 'lvl2-label'}
      ];
      var ret = tp.fieldsToModel(fields);
      expect(ret).to.not.equal(null);
      expect(ret.errors).to.be.ok;
      expect(ret.errors.perField['lvl2-label']).to.be.ok;
      expect(ret.errors.perField['lvl2-label'][0]).to.be.a('string');
    });
    it('detects missing parent relations', function () {
      var fields = [
        {type: 'administrative-classification:generic:level1:label', name: 'lvl1-label'},
        {type: 'administrative-classification:generic:level2:code:part', name: 'lvl2-code'},
        {type: 'administrative-classification:generic:level2:label', name: 'lvl2-label'}
      ];
      var ret = tp.fieldsToModel(fields);
      expect(ret).to.not.equal(null);
      expect(ret.errors).to.be.ok;
      expect(ret.errors.perField['lvl2-code']).to.be.ok;
      expect(ret.errors.perField['lvl2-code'][0]).to.be.a('string');
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
    it('should order correctly ', function () {
      var fields = [
        //{type: 'administrative-classification:generic:level4:code:part', name: 'lvl4-code'},
        {type: 'administrative-classification:generic:level3:code:part', name: 'lvl3-code'},
        {type: 'administrative-classification:generic:level7:code:part', name: 'lvl7-code'},
        {type: 'administrative-classification:generic:level2:code:part', name: 'lvl2-code'},
        {type: 'administrative-classification:generic:level1:code', name: 'lvl1-code'},
        {type: 'administrative-classification:generic:level6:code:part', name: 'lvl6-code'},
        {type: 'administrative-classification:generic:level5:code:part', name: 'lvl5-code'}
      ];
      var ret = tp.fieldsToModel(fields);
      expect(ret).to.not.equal(null);
      var model = ret.model;
      expect(model).to.be.ok;
      expect(model.dimensions).to.be.ok;
      expect(model.dimensions['administrative-classification'].primaryKey).to.eql([
        'lvl1_code',
        'lvl2_code',
        'lvl3_code',
        //'lvl4_code',
        'lvl5_code',
        'lvl6_code',
        'lvl7_code'
      ])
    });
    it('should detect duplicate names or titles and generate errors', function () {
      var fields = [
        [
          {type: 'administrative-classification:generic:level1:code:part', name: 'lvl1-code', title:'admin1'},
          {type: 'administrative-classification:generic:level2:code:part', name: 'lvl1-code', title:'admin2'}
        ],[
          {type: 'administrative-classification:generic:level3:code:part', name: 'lvl2-code', title:'admin3'},
          {type: 'administrative-classification:generic:level4:code:part', name: 'lvl3-code', title:'admin3'},
        ],[
          {type: 'administrative-classification:generic:level3:code:part', name: 'lvl4-code'},
          {type: 'administrative-classification:generic:level4:code:part', name: 'lvl4-code'},
        ]
      ];
      for (var fieldset of fields) {
        var ret = tp.fieldsToModel(fieldset);
        expect(ret).to.not.equal(null);
        expect(ret.errors).to.be.ok;
      }
    });
  });

  describe('os-types definition', function(done) {
    it('should contain only JTS valid types', function() {
      let fields = [];
      _.forEach(osTypes, function(osTypeValue, osType) {
        fields.push({name: osType, type: osTypeValue.dataType});
      });
      let JTSSchema = new Schema({fields: fields});
      return JTSSchema.then((schema) => {
        expect(schema).to.not.be.null;
      });
    });

    it('partial codes need to have a parent', function() {
      _.forEach(osTypes, function(osTypeValue, osType) {
        if (_.endsWith(osType, ':part')) {
          expect(osTypeValue.parent).to.be.ok;
        }
      });
    });

    it('should have a description and name for all types', function() {
      _.forEach(osTypes, function(osTypeValue, osType) {
        var parts = osType.split(':');
        var prefix = '';
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

    it('should have a group for all descriptions', function() {
      _.forEach(osTypeDescriptions, function(osTypeValue, osType) {
        var parts = osType.split(':');
        if (parts.length == 1 || parts[1] == '') {
          if (!osTypeValue.group) {
            console.log('MISSING GROUP FOR', osType);
          }
          expect(osTypeValue.group).to.be.ok;
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

    it('should have labelfor for all names and labels', function() {
      _.forEach(osTypes, function(osTypeValue, osType) {
        var parts = osType.split(':');
        var lastPart = parts[parts.length-1];
        if (lastPart == 'label' || lastPart == 'name' || lastPart == 'title') {
          var labelfor = osTypeValue.labelfor;
          if (!labelfor) {
            console.log('MISSING "labelfor" FOR', osType);
          }
          expect(labelfor).to.be.ok;
        }
      });
    });

    it('should have unique for all codes', function() {
      _.forEach(osTypes, function(osTypeValue, osType) {
        var parts = osType.split(':');
        var codes = ['id', 'code'];
        var found = false;
        _.forEach(codes, function (code) {
          var startFrom = parts.length-2;
          if (startFrom<0) { startFrom = 0; }
          if (_.lastIndexOf(parts, code) >= startFrom) {
            var unique = osTypeValue.uniqueIdentifier;
            if (!unique) {
              console.log('MISSING "uniqueIdentifier" FOR', osType);
            }
            expect(unique).to.be.true;
            found = true;
          }
        });
        if (!found && osTypeValue.labelfor) {
          var unique = osTypeValue.uniqueIdentifier;
          if (unique) {
            console.log('FOUND strange "uniqueIdentifier" FOR', osType);
          }
          expect(unique).to.not.be.true;
        }
      });
    });


  });

});
