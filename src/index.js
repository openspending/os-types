'use strict';
var os_types = require('./os-types.json');
var extraOptions = require('./extra-options.js');
var _ = require('lodash-addons');

class TypeProcessor {

    constructor() {
        this.types = os_types;
    }

    getAllTypes() {
        return Object.keys(this.types);
    }

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
            var ret = typ.slice(0,nextIndex);
            if ( nextIndex < typ.length ) {
                ret += typ[nextIndex];
            }
            return ret;
        });
        return _.uniq(options);
    }

    _checkInput(fields) {
        // Make sure we got an array...
        var valid = _.isArray(fields) || this._generalError("Fields should be an array");
        // ... of objects ...
        valid = valid &&
            _.every(fields, (f) => {
                return _.isObject(f) || this._generalError("Field items should be objects");
            });
        // ... with all the mandatory properties ...
        valid = valid &&
            _.every(fields, (f) => {
                return (_.hasIn(f, 'title') && _.hasIn(f, 'type')) ||
                    this._generalError("Field items should have 'title' and 'type'");
            });
        // ... and no unknown properties ...
        var allowedProperties = [
            'title', 'type', 'format', 'data', 'options', 'resource' // common properties
        ];
        valid = valid &&
            _.every(fields, (f) => {
                var diff = _.difference(_.keys(f), allowedProperties);
                return (diff.length == 0) ||
                    this._fieldError(f.title, "Got unknown properties "+diff);
            });
        // ... and all types are valid ...
        valid = valid &&
            _.every(fields, (f) => {
                return !f.type || _.hasIn(this.types, f.type) ||
                    this._fieldError(f.title, "Got unknown type " + f.type);
            });
        // ... and no unknown additional options ...
        valid = valid &&
            _.every(fields, (f) => {
                if ( !f.type ) { return true; }
                var allowedOptions = _.union(
                    _.get(extraOptions, 'dataTypes.'+this.types[f.type].dataType+'.options', []),
                    _.get(extraOptions, 'osTypes.'+f.type+'.options', [])
                );
                allowedOptions = _.map(allowedOptions, 'name');
                var options = _.get(f, 'options', {});
                options = _.keys(options);
                var diff = _.difference(options, allowedOptions);
                return (diff.length == 0) ||
                    this._fieldError(f.title, "Got unknown options key "+diff);
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

    _initErrors() {
        this.errors = { general: [], perField: {} };
    }

    _generalError(err) {
        this.errors.general.push(err);
        return false;
    }

    _fieldError(field, err) {
        var fieldErrors = this.errors.perField[field];
        if (!fieldErrors) {
            fieldErrors = [];
            this.errors.perField[field] = fieldErrors;
        }
        fieldErrors.push(err);
        return false;
    }

    _embedOptions(target, options, availableOptions) {
        _.forEach(availableOptions, (availableOption) => {
            var n = availableOption.name;
            if (_.hasIn(options, n)) {
                target[n] = options[n];
            } else if (_.hasIn(availableOption, 'defaultValue')) {
                target[n] = availableOption.defaultValue;
            }
        });
    }

    fieldsToModel(fields) {
        // Prepare errors
        this._initErrors();
        // Detect invalid data
        if ( !this._checkInput(fields) ) {
            var ret = {errors: this.errors};
            console.log(JSON.stringify(ret,null,2));
            return ret;
        }
        // Modelling
        var dimensions = {};
        var measures = {};
        var model = { dimensions, measures };
        var schema = {fields:{}, primaryKey:[]};
        this.allNames = [];
        _.forEach(_.filter(fields, (f) => { return !!f.type; }), (f) => {
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
                resource: f.resource,
                options: _.union(
                    _.get(extraOptions, 'dataTypes.'+osType.dataType+'.options', []),
                    _.get(extraOptions, 'osTypes.'+f.type+'.options', [])
                )
            };
            this._embedOptions(schema.fields[f.title], f.options, _.get(extraOptions, 'dataTypes.'+osType.dataType+'.options', []));

            if ( conceptType == 'value' ) {
                // Measure
                var measure = {
                    source: f.name,
                }
                // Extra properties
                if (f.resource)          { measure.resource = f.resource; }
                this._embedOptions(measure, f.options, _.get(extraOptions, 'osTypes.value.options', []));
                measures[f.name] = measure;
            } else {
                let dimension;
                if ( _.hasIn(dimensions, conceptType) ) {
                    dimension = dimensions[conceptType];
                } else {
                    dimension = {
                        dimensionType: osType.dimensionType,
                        primaryKey: [],
                        attributes: {},
                    };
                    if ( osType.classificationType ) {
                        dimension.classificationType = osType.classificationType;
                    }
                    dimensions[conceptType] = dimension;
                }
                var attribute = {
                    source: f.name,
                    title: f.title,
                };
                if ( f.resource ) {
                    attribute.resource = f.resource;
                }
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

        var fdp = {model, schema};
        //console.log(JSON.stringify(fdp,null,2));
        return fdp;
    }
}
module.exports = TypeProcessor;
