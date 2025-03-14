// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingTalk
//
// Copyright 2017 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const vm = require('vm');

const { clean } = require('../utils');
const FormatUtils = require('../format_utils');
const { Location } = require('../builtin/values');
const { FORMAT_TYPES, isNull } = require('./format_objects');

function compileCode(code) {
    return vm.runInNewContext(code);
}

// this regexp matches things that start with $
// it has 3 branches:
// - the first one matches '$$', which is a Make-style escaped $
// - the second one matches '$' followed by an identifier, followed by a non-identifier char
//   the identifier is captured and returned
// - the third one matches '${', then an identifier, then optionally ':' and either '%' or an option key, and finally a '}'
const PARAM_REGEX = /\$(?:\$|([a-zA-Z0-9_]+(?![a-zA-Z0-9_]))|{([a-zA-Z0-9_]+)(?::(%|[a-zA-Z-]+))?})/g;

module.exports = class Formatter extends FormatUtils {
    constructor(locale, timezone, schemaRetriever, gettext) {
        super(locale, timezone, gettext);
        this._schemas = schemaRetriever;
    }

    _displayValue(value, opt) {
        if (value === undefined || value === null)
            return value;
        if (Array.isArray(value))
            return value.map((v) => this._displayValue(v, opt)).join(this._(", "));
        if (value instanceof Date) {
            if (isNaN(value))
                return this._("N/A");
            else if (opt === 'iso-date')
                return value.toISOString();
            else if (opt === 'time')
                return this.timeToString(value);
            else if (opt === 'date')
                return this.dateToString(value);
            else
                return this.dateAndTimeToString(value);
        }
        if (Location.isLocation(value)) {
            if (opt === 'lat')
                return value.y;
            else if (opt === 'lon')
                return value.x;
            else
                return this.locationToString(value);
        }

        if (opt === 'enum')
            return clean(String(value));
        if (typeof value === 'number') {
            if (opt === '%') {
                value = value*100;
                opt = '';
            }
            if (opt)
                return this.measureToString(value, 1, opt);
            else
                return (Math.floor(value) === value ? value.toFixed(0) : value.toFixed(2));
        }

        if (value.display)
            return value.display;
        return value.toLocaleString(this._locale);
    }

    _replaceInString(str, argMap) {
        if (typeof str !== 'string')
            return undefined;
        if (this._missingAllParams(str, argMap))
            return null;
        return str.replace(PARAM_REGEX, (match, param1, param2, opt) => {
            if (match === '$$')
                return '$';
            let param = param1 || param2;
            let value = argMap[param];
            return this._displayValue(value, opt);
        });
    }

    _missingAllParams(str, argMap) {
        // clone the regex because we exec it repeatedly with the g flag (which modifies the object)
        const reg = new RegExp(PARAM_REGEX);
        let match = reg.exec(str);
        if (match === null)
            return false; // if there is no $ at all, there is no param missing
        let existSome = false;
        while (match !== null) {
            if (match[0] === '$$') {
                // escaped dollar sign
                match = reg.exec(str);
                continue;
            }
            const param = match[1] || match[2];
            if (!isNull(argMap[param]))
                existSome = true;
            match = reg.exec(str);
        }
        return !existSome;
    }

    _formatFallback(outputValue) {
        return Object.keys(outputValue).map((key) => {
            return `${clean(key)}: ${this._displayValue(outputValue[key])}`;
        });
    }

    _formatAggregation(outputValue, operator, outputType) {
        if (operator === 'count' && Object.prototype.hasOwnProperty.call(outputValue, 'count'))
            return [this._("I found %d results.").format(outputValue.count)];

        let key = Object.keys(outputValue)[0];

        switch (operator) {
        case 'count':
            return [this._("I found %d distinct values of %s.").format(outputValue[key], clean(key))];

        case 'min':
            return [this._("The minimum %s is %s.").format(clean(key), this._displayValue(outputValue[key]))];

        case 'max':
            return [this._("The maximum %s is %s.").format(clean(key), this._displayValue(outputValue[key]))];

        case 'avg':
            return [this._("The average %s is %s.").format(clean(key), this._displayValue(outputValue[key]))];

        case 'sum':
            return [this._("The total %s is %s.").format(clean(key), this._displayValue(outputValue[key]))];

        default:
            throw new TypeError(`Unexpected aggregation operator ${operator}`);
        }
    }

    async formatForType(outputType, outputValue, hint) {
        // apply masquerading for @remote.receive
        // outputValue[0..2] are the input parameters (principal, programId and flow)
        // outputValue[3] is the real underlying output type, and outputValue.slice(4)
        // is the real data
        if (outputType === 'org.thingpedia.builtin.thingengine.remote:receive')
            outputType = String(outputValue.__kindChannel);

        // Handle builtin:get_commands specially
        if (outputType === 'org.thingpedia.builtin.thingengine.builtin:get_commands')
            return { type: 'program', program: outputValue.program };


        if (outputType === null)
            return this._formatFallback(outputValue);

        // for now, ignore multiple output types
        if (outputType.indexOf('+') >= 0) {
            let types = outputType.split('+');
            outputType = types[types.length-1];
        }

        const aggregation = /^([a-zA-Z]+)\(([^)]+)\)$/.exec(outputType);
        if (aggregation !== null)
            return this._formatAggregation(outputValue, aggregation[1], aggregation[2]);

        let [kind, function_name] = outputType.split(':');
        return this._schemas.getFormatMetadata(kind, function_name).then((metadata) => {
            if (metadata.length)
                return this.format(metadata, outputValue, hint);
            else
                return this._formatFallback(outputValue);
        });
    }

    _toFormatObjects(codeResult) {
        if (!Array.isArray(codeResult))
            codeResult = [codeResult];
        return codeResult.map((r) => {
            if (r === null || typeof f !== 'object')
                return r;
            if (r.type === 'text')
                return r.text;

            const formatType = FORMAT_TYPES[r.type];
            if (!formatType) {
                console.log(`WARNING: unrecognized format type ${r.type}`);
                return null;
            }
            const obj = new formatType(r);
            if (!obj.isValid())
                return null;
            return obj;
        });
    }

    format(formatspec, argMap, hint) {
        return this._applyHint(formatspec.map((f, i) => {
            if (typeof f === 'function')
                return this._toFormatObjects(f(argMap, hint, this));
            if (typeof f === 'string')
                return this._replaceInString(f, argMap);
            if (f === null)
                return null;
            if (typeof f !== 'object')
                return String(f);
            if (f.type === 'text')
                return this._replaceInString(f.text, argMap);
            if (f.type === 'code') {
                var compiled = compileCode('(' + f.code + ')');
                formatspec[i] = compiled;
                return this._toFormatObjects(compiled(argMap, hint, this));
            }

            const formatType = FORMAT_TYPES[f.type];
            if (!formatType) {
                console.log(`WARNING: unrecognized format type ${f.type}`);
                return null;
            }
            const obj = new formatType(f);
            obj.replaceParameters(this, argMap);

            if (!obj.isValid())
                return null;

            return obj;
        }), hint);
    }

    _normalize(formatted) {
        // filter out null/undefined in the array
        let filtered = formatted.filter((formatted) => !isNull(formatted));
        // flatten formatted (returning array in function causes nested array)
        return [].concat.apply([], filtered);
    }

    _applyHint(formatted, hint) {
        formatted = this._normalize(formatted);

        if (hint === 'string') {
            formatted = formatted.map((x) => {
                if (typeof x !== 'object')
                    return this.anyToString(x);
                return x.toLocaleString(this._);
            });
            return formatted.join('\n');
        } else {
            return formatted;
        }
    }

    anyToString(o) {
        if (Array.isArray(o))
            return (o.map(this.anyToString, this).join(', '));
        else if (Location.isLocation(o))
            return this.locationToString(o);
        else if (typeof o === 'number')
            return (Math.floor(o) === o ? o.toFixed(0) : o.toFixed(3));
        else if (o instanceof Date)
            return this.dateAndTimeToString(o);
        else
            return String(o);
    }
};
