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

    autoComplete(prefix) {
        if ( !prefix ) {
            prefix = '';
        }
        var options = _.filter(this.getAllTypes(), (typ) => {
          return _.startsWith(typ, prefix);
        });
        var prefixLen = prefix.length;
        var findNextIndex = (typ) => {
            for ( var i = prefixLen ; i < typ.length ; i++ ) {
                if ( typ[i] == ":" ) {
                    break;
                }
            }
            return i;
        }
        options = _.map(options, (typ) => {
            var nextIndex = findNextIndex(typ);
            var ret = _.last(_.split(typ.slice(0,nextIndex),':'));
            if ( nextIndex < typ.length ) {
                ret += typ[nextIndex];
            }
            return ret;
        });
        return _.uniq(options);
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
        var allowedProperties = [
            'title', 'type', 'format', 'data',  // common properties
            'currency', 'factor', 'direction', 'phase', // for measures
        ];
        valid = valid &&
            _.every(fields, (f) => {
                return _.difference(_.keys(f), allowedProperties).length == 0;
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
        var schema = {fields:{}, primaryKey:[]};
        this.allNames = [];
        _.forEach(fields, (f) => {
            var osType = this.types[f.type];
            f.name = this._titleToName(f.title, f.type);
            var conceptType = _.split(f.type,':')[0];
            schema.fields[f.title] = {
                title: f.title,
                name: f.name,
                type: osType.dataType,
                format: osType.format || f.format || 'default',
                osType: f.type,
                conceptType: conceptType,
                resource: f.resource
            };

            if ( conceptType == 'value' ) {
                // Measure
                var measure = {
                    source: f.name,
                    resource: f.resource,
                    // Extra properties
                    currency: f.currency,
                    factor: f.factor,
                    direction: f.direction,
                    phase: f.phase
                };
                measures[f.name] = measure;
            } else {
                let dimension;
                if ( _.hasIn(dimensions, conceptType) ) {
                    dimension = dimensions[conceptType];
                } else {
                    dimension = {
                        dimensionType: osType.dimensionType,
                        classificationType: osType.classificationType,
                        primaryKey: [],
                        attributes: {},
                    };
                    dimensions[conceptType] = dimension;
                }
                var attribute = {
                    source: f.name,
                    title: f.title,
                    resource: f.resource
                };
                dimension.attributes[f.name] = attribute;
                if (osType.uniqueIdentifier) {
                    dimension.primaryKey.push(f.name);
                    schema.primaryKey.push(f.name);
                }
            }
        });
        // Process parent, labelFor
        var findAttribute = (field, osType) => {
            if ( field ) {
                return dimensions[field.conceptType].attributes[field.name];
            }
            if ( osType ) {
                var field = _.find(_.values(schema.fields), (i) => {
                    return _.startsWith(i.osType, osType);
                });
                return findAttribute(field);
            }
        };
        _.forEach(_.values(schema.fields), (field) => {
            var osType = this.types[field.osType];
            var labelFor = osType.labelFor;
            var parent = osType.parent;
            if ( labelFor || parent ) {
                var attribute = findAttribute(field);
                if ( labelFor ) {
                    var targetAttribute = findAttribute(null, labelFor);
                    if ( targetAttribute ) {
                        attribute.labelFor = targetAttribute.source;
                    }
                }
                if ( parent ) {
                    var targetAttribute = findAttribute(null, parent);
                    if ( targetAttribute ) {
                        attribute.parent = targetAttribute.source;
                    }
                }
            }
        });

        var ret = {model, schema};
        return ret;
    }
}
module.exports = TypeProcessor;
