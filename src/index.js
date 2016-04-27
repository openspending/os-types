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
                return (_.hasIn(f, 'name') && _.hasIn(f, 'type')) ||
                    this._generalError("Field items should have 'name' and 'type'");
            });
        // ... and no unknown properties ...
        var allowedProperties = [
            'name', 'title', 'type', 'format', 'data', 'options', 'resource' // common properties
        ];
        valid = valid &&
            _.every(fields, (f) => {
                var diff = _.difference(_.keys(f), allowedProperties);
                return (diff.length == 0) ||
                    this._fieldError(f.name, "Got unknown properties "+diff);
            });
        // ... and all types are valid ...
        valid = valid &&
            _.every(fields, (f) => {
                return !f.type || _.hasIn(this.types, f.type) ||
                    this._fieldError(f.name, "Got unknown type " + f.type);
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
                    this._fieldError(f.name, "Got unknown options key "+diff);
            });
        return valid;
    }

    _titleToSlug(title, type) {
        var slugRe = new RegExp('[a-zA-Z0-9]+','g');
        var vowelsRe = new RegExp('[aeiou]+','g');
        var slugs = _.deburr(title).match(slugRe);
        if ( slugs == null || slugs.length == 0 ) {
            slugs = _.join(type.split(vowelsRe),'').match(slugRe);
        }
        var slug = _.join(slugs, '_');
        if ( this.allNames.indexOf(slug) >= 0 ) {
            let i = 2;
            while ( true ) {
                let attempt = slug + '_' + i;
                if ( this.allNames.indexOf(attempt) < 0 ) {
                    slug = attempt;
                    break;
                }
                i+=1;
            }
        }
        this.allNames.push(slug)
        return slug;
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
            if (_.hasIn(options, n) && options[n]) {
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
            if (!f.title) {
                f.title = f.name;
            }
            f.slug = this._titleToSlug(f.title, f.type);
            var conceptType = _.split(f.type,':')[0];
            schema.fields[f.title] = {
                title: f.title,
                name: f.name,
                slug: f.slug,
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
                    title: f.title
                }
                // Extra properties
                if (f.resource)          { measure.resource = f.resource; }
                this._embedOptions(measure, f.options, _.get(extraOptions, 'osTypes.value.options', []));
                measures[f.slug] = measure;
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
                    title: f.title
                };
                if ( f.resource ) {
                    attribute.resource = f.resource;
                }
                dimension.attributes[f.slug] = attribute;
                if (osType.uniqueIdentifier) {
                    dimension.primaryKey.push(f.slug);
                    schema.primaryKey.push(f.name);
                }
            }
        });
        // Process parent, labelfor
        var findAttribute = (field, osType) => {
            if ( field ) {
                return {key:field.slug, attr:dimensions[field.conceptType].attributes[field.slug]};
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
            var labelfor = osType.labelfor;
            var parent = osType.parent;
            if ( labelfor || parent ) {
                var attribute = findAttribute(field).attr;
                if ( labelfor ) {
                    var targetAttribute = findAttribute(null, labelfor);
                    if ( targetAttribute ) {
                        attribute.labelfor = targetAttribute.key;
                    }
                }
                if ( parent ) {
                    var targetAttribute = findAttribute(null, parent);
                    if ( targetAttribute ) {
                        attribute.parent = targetAttribute.key;
                    }
                }
            }
        });
        // Fix primary keys in case they're missing
        _.forEach(model.dimensions, (dimension) => {
           if (dimension.primaryKey.length == 0) {
               dimension.primaryKey = _.keys(dimension.attributes);
           }
        });

        var fdp = {model, schema};
        //console.log(JSON.stringify(fdp,null,2));
        return fdp;
    }
}
module.exports = TypeProcessor;
