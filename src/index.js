'use strict';
var os_types = require('./os-types.json');
var _ = require('lodash-addons');

class TypeProcessor {

    constructor() {
        this.types = os_types;
    }

    getAllTypes() {
        return Object.keys(this.types);
    };

    _checkInput(fields) {
        // Make sure we got an array...
        var valid = _.isArray(fields);
        // ... of objects ...
        valid = valid &&
            _.every(fields, (f) => {
                return _.isObject(f);
            });
        // ... with all the mandatory properties ...
        valid = valid &&
            _.every(fields, (f) => {
                return _.hasIn(f, 'title') && _.hasIn(f, 'type');
            });
        // ... and no unknown properties ...
        valid = valid &&
            _.every(fields, (f) => {
                return _.difference(_.keys(f), ['title', 'type', 'format', 'data']).length == 0;
            });
        // ... and all types are valid ...
        valid = valid &&
            _.every(fields, (f) => {
                return _.hasIn(this.types, f.type);
            });
        return valid;
    }

    _titleToName(title, type) {
        var slugRe = new RegExp('[a-zA-Z0-9]+','g');
        var vowelsRe = new RegExp('[aeiou]+','g');
        var slugs = _.deburr(title).match(slugRe);
        if ( slugs == null || slugs.length == 0 ) {
            slugs = _.join(type.split(vowelsRe),'').match(slugRe);
        }
        var name = _.join(slugs, '_');
        if ( this.allNames.indexOf(name) >= 0 ) {
            let i = 2;
            while ( true ) {
                let attempt = name + '_' + i;
                if ( this.allNames.indexOf(attempt) < 0 ) {
                    name = attempt;
                    break;
                }
                i+=1;
            }
        }
        this.allNames.push(name)
        return name;
    }

    fieldsToModel(fields) {
        // Detect invalid data
        if ( !this._checkInput(fields) ) {
            return null;
        }
        // Modelling
        var dimensions = {};
        var measures = {};
        var model = { dimensions, measures };
        var schema = {};
        this.allNames = [];
        _.forEach(fields, (f) => {
            var osType = this.types[f.type];
            f.name = this._titleToName(f.title, f.type);
            schema[f.title] = {
                title: f.title,
                name: f.name,
                type: osType.dataType,
                format: osType.format || f.format || 'default'
            };

            var conceptType = _.split(f.type,':')[0];
            if ( conceptType == 'value' ) {
                // Measure
                var measure = {
                    source: f.name,
                    resource: f.resource
                };
                measures[f.name] = measure;
            } else {
                let dimension;
                if ( _.hasIn(dimensions, conceptType) ) {
                    dimension = dimensions[conceptType];
                } else {
                    dimension = {
                        dimensionType: osType.dimensionType,
                        primaryKey: [],
                        attributes: {}
                    };
                    dimensions[conceptType] = dimension;
                }
                var attribute = {
                    source: f.name,
                    resource: f.resource
                };
                dimension.attributes[f.name] = attribute;
                if ( osType.uniqueIdentifier ) {
                    dimension.primaryKey.push(f.name);
                }
            }
        });
        var ret = {model, schema};
        console.log(JSON.stringify(ret));
        return ret;
    }
}
module.exports = TypeProcessor;
