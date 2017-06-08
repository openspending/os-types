'use strict';
let osTypes = require('./os-types.json');
let osTypesDescriptions = require('./os-type-descriptions.json');
let extraOptions = require('./extra-options.js');
let _ = require('lodash-addons');
let JTS = require('jsontableschema');
let Schema = JTS.Schema;

class TypeProcessor {

    constructor() {
        this.types = osTypes;
        this.typesDescriptions = osTypesDescriptions;
        this.ident = x => { return x; }
        this._addExtraTypes();
    }

    _addExtraTypes() {
        for (let i = 1 ; i <= 40 ; i++) {
            this.types[`unknown:string-${i}:code`] = {
                dimensionType: "other",
                dataType: "string",
                uniqueIdentifier: true
            };
            this.types[`unknown:string-${i}:label`] = {
                dimensionType: "other",
                dataType: "string",
                labelfor: `unknown:string-${i}:code`
            };
            this.typesDescriptions[`unknown:string-${i}:`] = {
                displayName: `unknown dimension #${i}`,
                description: `Placeholder for an unknown dimension #${i}`
            };
            this.typesDescriptions[`unknown:string-${i}:code`] = {
                displayName: `unknown dimension #${i} code`,
                description: `Unknown dimension #${i}'s code`
            };
            this.typesDescriptions[`unknown:string-${i}:label`] = {
                displayName: `unknown dimension #${i} label`,
                description: `Unknown dimension #${i}'s label`
            };
        }
    }

    getAllTypes() {
        return Object.keys(this.types);
    }

    getDataTypeExtraOptions(dataType) {
      return _.union(
        _.get(
          extraOptions,
          'dataTypes.' + this.types[dataType].dataType + '.options',
          []
        ),
        _.get(
          extraOptions,
          'osTypes.' + dataType + '.options',
          []
        )
      );
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
        options = _.map(_.uniq(options), (k) => {
            return _.extend({type:k}, this.typesDescriptions[k]);
        });
        options = _.sortBy(options, 'type');
        options = _.sortBy(options, 'group');
        var group = null;
        _.forEach(options, (option) => {
            if (option.group == group) {
               delete option.group;
            } else {
               group = option.group;
            }
        });
        return options;
    }

    _getJTSTypeByName(name, options) {
        return _.find(
          _.map(_.toPairs(JTS), function(pair) {
            var JTSType = pair[0];
            var JTSTypeValue = pair[1];
            if (_.endsWith(JTSType, 'Type') ) {
                var ret = new JTSTypeValue(options);
                if (ret.name == name) {
                    return ret;
                }
            }
        }));
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
            'name', 'title', 'type', 'format', 'data',
            'options', 'resource', 'description', 'constant' // common properties
        ];
        valid = valid &&
            _.every(fields, (f) => {
                var diff = _.difference(_.keys(f), allowedProperties);
                return (diff.length == 0) ||
                    this._fieldError(f.name, "Got unknown properties "+diff);
            });
        // ... and no duplicate names ...
        valid = valid &&
            _.chain(fields)
             .countBy('name')
             .toPairs()
              .filter((pair) => { return pair[1] <= 1 || this._fieldError(pair[0], "Got duplicate name " + pair[0]); })
             .value()
             .length == fields.length;
        // ... and no duplicate titles ...
        valid = valid &&
            _.chain(fields)
             .filter((field) => !!field.title)
             .countBy('title')
             .toPairs()
             .filter((pair) => { return !(pair[1] <= 1 || this._fieldError(pair[0], "Got duplicate title " + pair[0])); })
             .value()
             .length == 0;
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
        // ... and data samples match the selected datatype ...
        if (valid) {
            _.forEach(fields, (f) => {
                if ( f.type && f.data ) {
                    var typeOptions = _.get(extraOptions, 'dataTypes.'+this.types[f.type].dataType+'.options', []);
                    typeOptions = _.keyBy(typeOptions, 'name');
                    var options = _.pick(f.options,
                      _.keys(typeOptions)
                    );
                    options = _.mapValues(options, (value, key) => {
                        return (typeOptions[key].transform || this.ident)(value);
                    });
                    let jtsSchemaObj = {fields: [{name: '_', type: this.types[f.type].dataType}]};
                    this._promise(new Schema(jtsSchemaObj).then((schema) => {
                      _.every(f.data, (datum) => {
                        try {
                          schema.castRow([datum]);
                        }
                        catch(e) {
                          this._fieldError(f.name, "Data cannot be cast to this type '" + datum + "'");
                        }
                      });
                    }));
                }
            });
        }
        return valid;
    }

    _titleToSlug(title, type) {
        var slugRe = new RegExp('[a-zA-Z0-9]+','g');
        var slugs = _.deburr(title).match(slugRe);
        if ( slugs == null || slugs.length == 0 ) {
            slugs = type.match(slugRe);
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

    _promise(promise) {
        if (!!this.promise) {
            this.promise.then(() => {
                return promise;
            });
        } else {
            this.promise = promise;
        }
    }

    _embedOptions(target, options, availableOptions) {
        _.forEach(availableOptions, (availableOption) => {
            var n = availableOption.name;
            var transform = availableOption.transform || this.ident;
            if (_.hasIn(options, n) && options[n]) {
                target[n] = transform(options[n]);
            } else if (_.hasIn(availableOption, 'defaultValue')) {
                target[n] = transform(availableOption.defaultValue);
            }
        });
    }

    fieldsToModel(fields) {
        // Prepare errors
        this._initErrors();
        // Detect invalid data
        if ( !this._checkInput(fields) ) {
            var ret = {errors: this.errors};
            //console.log(JSON.stringify(ret,null,2));
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
            f.slug = this._titleToSlug(f.name, f.type);
            var conceptType = _.split(f.type,':')[0];
            schema.fields[f.name] = {
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
            this._embedOptions(schema.fields[f.name], f.options, _.get(extraOptions, 'dataTypes.'+osType.dataType+'.options', []));

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
                if ( f.constant ) {
                    attribute.constant = f.constant;
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
                    } else {
                        this._fieldError(field.name, "Couldn't find a column mapped to the matching 'code' ("+labelfor+")");
                    }
                }
                while ( parent ) {
                    var targetAttribute = findAttribute(null, parent);
                    var osTypeName = _.find(_.keys(this.types), (i) => {
                        return _.startsWith(i, parent);
                    });
                    osType = this.types[osTypeName];
                    parent = osType.parent;
                    if ( targetAttribute ) {
                        attribute.parent = targetAttribute.key;
                        break;
                    } else if (!parent) {
                        this._fieldError(field.name, "Couldn't find a column mapped to the parent of this type ("+
                                                     (this.types[field.osType].parent)+")");
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
        // Reorder primary keys based on parents
        _.forEach(model.dimensions, (dimension, name) => {
            while (true) {
                var swaps = 0;
                var primaryKey = dimension.primaryKey;
                for (let i = 0 ; i < primaryKey.length ; i++) {
                    var attrib = dimension.attributes[primaryKey[i]];
                    if (!attrib.parent) {
                        continue;
                    }
                    for (let j = i+1 ; j < primaryKey.length ; j++) {
                        if (primaryKey[j] == attrib.parent) {
                            var temp = primaryKey[i];
                            primaryKey[i] = primaryKey[j];
                            primaryKey[j] = temp;
                            swaps++;
                            break;
                        }
                    }
                }
                if (swaps == 0) {
                    break;
                }
            }
        });

        var fdp = {model, schema};
        if (this.errors.general.length || _.keys(this.errors.perField).length) {
            fdp.errors = this.errors;
        }
        if (!!this.promise) {
            fdp.promise = this.promise;
        }
        //console.log(JSON.stringify(fdp,null,2));
        return fdp;
    }
}

module.exports = TypeProcessor;
