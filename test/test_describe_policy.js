// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Almond
//
// Copyright 2017 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

require('./polyfill');

const assert = require('assert');
const Q = require('q');
Q.longStackSupport = true;
const Describe = require('../lib/describe');
const Grammar = require('../lib/grammar_api');
const SchemaRetriever = require('../lib/schema');

const _mockSchemaDelegate = require('./mock_schema_delegate');
const schemaRetriever = new SchemaRetriever(_mockSchemaDelegate, null, true);

var TEST_CASES = [
    ['true : * => *',
     'anyone is allowed to read all your data and then perform any action with it'],

    ['true : * => notify',
     'anyone is allowed to read all your data'],

    ['true : now => *',
     'anyone is allowed to perform any action'],

    ['true : @com.bing.* => *',
     'anyone is allowed to read your Bing and then perform any action with it'],

    ['true : @com.bing.* => notify',
     'anyone is allowed to read your Bing'],

    ['true : * => @com.twitter.*',
     'anyone is allowed to read all your data and then use it to perform any action on your Twitter'],

    ['true : now => @com.twitter.*',
     'anyone is allowed to perform any action on your Twitter'],

    // manually written test cases
    ['true : now => @com.twitter.post',
     'anyone is allowed to tweet any status'],

    ['true : * => @com.twitter.post',
     'anyone is allowed to read all your data and then use it to tweet any status'],

    ['true : @com.bing.* => @com.twitter.post',
     'anyone is allowed to read your Bing and then use it to tweet any status'],

    ['true : @com.bing.web_search => *',
     'anyone is allowed to read websites matching any query on Bing and then perform any action with it'],

    ['true : @com.bing.web_search => @com.twitter.*',
     'anyone is allowed to read websites matching any query on Bing and then use it to perform any action on your Twitter'],

    ['source == "mom"^^tt:username : now => @com.twitter.post',
     '@mom is allowed to tweet any status'],

    ['group_member(source, "family"^^tt:contact_group_name) : now => @com.twitter.post',
     'anyone in the @family group is allowed to tweet any status'],

    ['source == "mom"^^tt:username || source == "dad"^^tt:username : now => @com.twitter.post',
     'anyone if the requester is equal to @mom or the requester is equal to @dad is allowed to tweet any status'],

    ['true : now => @com.twitter.post, status == "foo"',
     'anyone is allowed to tweet “foo”'],

    ['true : now => @com.twitter.post, !(status == "foo")',
     'anyone is allowed to tweet any status if the status is not equal to “foo”'],

    ['true : now => @com.twitter.post, status =~ "foo"',
     'anyone is allowed to tweet any status if the status contains “foo”'],

    ['true : now => @com.twitter.post, !(status =~ "foo")',
     'anyone is allowed to tweet any status if the status does not contain “foo”'],

    ['true : now => @com.twitter.post, starts_with(status, "foo")',
     'anyone is allowed to tweet any status if the status starts with “foo”'],

    ['true : now => @com.twitter.post, !starts_with(status, "foo")',
     'anyone is allowed to tweet any status if the status does not start with “foo”'],

    ['true : now => @com.twitter.post, ends_with(status, "foo")',
     'anyone is allowed to tweet any status if the status ends with “foo”'],

    ['true : now => @com.twitter.post, !ends_with(status, "foo")',
     'anyone is allowed to tweet any status if the status does not end with “foo”'],

    ['true : now => @com.twitter.post, prefix_of(status, "foo")',
     'anyone is allowed to tweet any status if the status is a prefix of “foo”'],

    ['true : now => @com.twitter.post, !prefix_of(status, "foo")',
     'anyone is allowed to tweet any status if the status is not a prefix of “foo”'],

    ['true : now => @com.twitter.post, suffix_of(status, "foo")',
     'anyone is allowed to tweet any status if the status is a suffix of “foo”'],

    ['true : now => @com.twitter.post, !suffix_of(status, "foo")',
     'anyone is allowed to tweet any status if the status is not a suffix of “foo”'],

    ['true : now => @com.twitter.post, status == "foo" || status == "bar"',
     'anyone is allowed to tweet any status if the status is equal to “foo” or the status is equal to “bar”'],

    ['true : now => @com.twitter.post, status =~ "foo" && status =~ "bar"',
     'anyone is allowed to tweet any status if the status contains “foo” and the status contains “bar”'],

    ['true : now => @thermostat.set_target_temperature, value == 70F',
     'anyone is allowed to set your thermostat to 70 F'],

    ['true : now => @thermostat.set_target_temperature, value >= 70F',
     'anyone is allowed to set your thermostat to any value if the value is greater than or equal to 70 F'],

    ['true : now => @thermostat.set_target_temperature, value <= 70F',
     'anyone is allowed to set your thermostat to any value if the value is less than or equal to 70 F'],

    ['true : now => @thermostat.set_target_temperature, !(value >= 70F)',
     'anyone is allowed to set your thermostat to any value if the value is less than 70 F'],

    ['true : now => @thermostat.set_target_temperature, !(value <= 70F)',
     'anyone is allowed to set your thermostat to any value if the value is greater than 70 F'],

    ['true : @security-camera.current_event => notify',
     'anyone is allowed to read the current event detected on your security camera'],

    ['true : @security-camera.current_event, has_person == true => notify',
     'anyone is allowed to read the current event detected on your security camera if the has person is equal to true'],

    ['true : @security-camera.current_event, @org.thingpedia.builtin.thingengine.builtin.get_time() { time >= makeTime(19,0) } => notify',
     'anyone is allowed to read the current event detected on your security camera if the current time is after 7:00 PM'],

    ['true : @security-camera.current_event, @org.thingpedia.builtin.thingengine.builtin.get_time() { time >= makeTime(12,0) } => notify',
     'anyone is allowed to read the current event detected on your security camera if the current time is after 12:00 PM'],

    ['true : @security-camera.current_event, @org.thingpedia.builtin.thingengine.builtin.get_time() { time >= makeTime(0,0) } => notify',
     'anyone is allowed to read the current event detected on your security camera if the current time is after 12:00 AM'],

    ['true : @security-camera.current_event, @org.thingpedia.builtin.thingengine.builtin.get_time() { time >= makeTime(7,30) } => notify',
     'anyone is allowed to read the current event detected on your security camera if the current time is after 7:30 AM'],

    ['true : @security-camera.current_event, @org.thingpedia.builtin.thingengine.builtin.get_time() { time >= makeTime(7,30,15) } => notify',
     'anyone is allowed to read the current event detected on your security camera if the current time is after 7:30:15 AM'],

    ['true : @security-camera.current_event, @org.thingpedia.builtin.thingengine.builtin.get_time() { time >= makeTime(19,30,15) } => notify',
     'anyone is allowed to read the current event detected on your security camera if the current time is after 7:30:15 PM'],

    ['true : @security-camera.current_event, @org.thingpedia.builtin.thingengine.builtin.get_time() { time >= makeTime(17,00) && time <= makeTime(19,00) } => notify',
     'anyone is allowed to read the current event detected on your security camera if the current time is after 5:00 PM and the current time is before 7:00 PM'],

    ['true : @security-camera.current_event, @org.thingpedia.builtin.thingengine.builtin.get_gps() { location == $context.location.home } => notify',
     'anyone is allowed to read the current event detected on your security camera if the my location is equal to at home'],

    ['true : @security-camera.current_event, @org.thingpedia.builtin.thingengine.builtin.get_gps() { !(location == $context.location.home) } => notify',
     'anyone is allowed to read the current event detected on your security camera if the my location is not equal to at home'],

    ['true : @security-camera.current_event, @org.thingpedia.builtin.thingengine.builtin.get_gps() { !(location == $context.location.home) && !(location == $context.location.work) } => notify',
     'anyone is allowed to read the current event detected on your security camera if the my location is not equal to at home and the my location is not equal to at work'],

    ['true : @security-camera.current_event, @org.thingpedia.weather.current(location=$context.location.current_location) { temperature >= 21C } => notify',
     'anyone is allowed to read the current event detected on your security camera if the the temperature of the current weather for here is greater than or equal to 21 C'],
    ['true : @security-camera.current_event, @org.thingpedia.weather.current(location=$context.location.current_location) { temperature == 21C } => notify',
     'anyone is allowed to read the current event detected on your security camera if the the temperature of the current weather for here is equal to 21 C'],
    ['true : @security-camera.current_event, @org.thingpedia.weather.current(location=$context.location.current_location) { !(temperature == 21C) } => notify',
     'anyone is allowed to read the current event detected on your security camera if the the temperature of the current weather for here is not equal to 21 C'],
    ['true : @security-camera.current_event, @org.thingpedia.weather.current(location=$context.location.current_location) { temperature <= 21C && temperature >= 19C } => notify',
     'anyone is allowed to read the current event detected on your security camera if for the current weather for here, the temperature is less than or equal to 21 C and the temperature is greater than or equal to 19 C'],
    ['true : @security-camera.current_event, @org.thingpedia.weather.current(location=$context.location.current_location) { temperature >= 21C || temperature <= 19C } => notify',
     'anyone is allowed to read the current event detected on your security camera if for the current weather for here, the temperature is greater than or equal to 21 C or the temperature is less than or equal to 19 C'],


    ['true : @com.bing.web_search, query == "foo" => notify',
     'anyone is allowed to read websites matching “foo” on Bing'],

    ['true : @com.bing.web_search, query == "foo" || query == "bar" => notify',
     'anyone is allowed to read websites matching any query on Bing if the query is equal to “foo” or the query is equal to “bar”'],

    ['true : @com.bing.web_search, query == "foo" && description =~ "lol" => notify',
     'anyone is allowed to read websites matching “foo” on Bing if the description contains “lol”'],

    ['true : @com.bing.web_search, !(query == "foo" && description =~ "lol") => notify',
     'anyone is allowed to read websites matching any query on Bing if not the query is equal to “foo” and the description contains “lol”'],

    ['true : @com.bing.web_search, (query == "foo" || query == "bar") && description =~ "lol" => notify',
     'anyone is allowed to read websites matching any query on Bing if the query is equal to “foo” or the query is equal to “bar” and the description contains “lol”'],

    ['true : @com.washingtonpost.get_article => notify',
    'anyone is allowed to read the latest articles in the any section section of the Washington Post'],

    ['true : @com.washingtonpost.get_article, section == enum(world) => notify',
    'anyone is allowed to read the latest articles in the world section of the Washington Post'],

    ['true : @com.washingtonpost.get_article, section == enum(world) || section == enum(opinions) => notify',
    'anyone is allowed to read the latest articles in the any section section of the Washington Post if the section is equal to world or the section is equal to opinions'],

    ['true : @com.wsj.get, section == enum(world) && updated >= makeDate() => notify',
    'anyone is allowed to read articles published in the world section of the Wall Street Journal if the updated is after now'],
    ['true : @com.wsj.get, section == enum(world) && updated <= makeDate() => notify',
    'anyone is allowed to read articles published in the world section of the Wall Street Journal if the updated is before now'],

    ['true : @com.wsj.get, section == enum(world) && updated >= makeDate(2018, 5, 4) => notify',
    'anyone is allowed to read articles published in the world section of the Wall Street Journal if the updated is after Friday, May 4, 2018'],
    ['true : @com.wsj.get, section == enum(world) && updated <= makeDate(2018, 5, 4) => notify',
    'anyone is allowed to read articles published in the world section of the Wall Street Journal if the updated is before Friday, May 4, 2018'],
    ['true : @com.wsj.get, section == enum(world) && !(updated <= makeDate(2018, 5, 4)) => notify',
    'anyone is allowed to read articles published in the world section of the Wall Street Journal if the updated is after Friday, May 4, 2018'],
    ['true : @com.wsj.get, section == enum(world) && !(updated >= makeDate(2018, 5, 4)) => notify',
    'anyone is allowed to read articles published in the world section of the Wall Street Journal if the updated is before Friday, May 4, 2018'],

    /*['true : @com.wsj.get, section == enum(world) && updated >= makeDate(2018, 5, 4, 17, 30, 0) => notify',
    'anyone is allowed to read articles published in the world section if the updated is after 5/4/2018, 5:30:00 PM'],*/

    ['true : @com.wsj.get, section == enum(world) && updated >= start_of(day) => notify',
    'anyone is allowed to read articles published in the world section of the Wall Street Journal if the updated is after the start of today'],

    ['true : @com.wsj.get, section == enum(world) && updated >= start_of(week) => notify',
    'anyone is allowed to read articles published in the world section of the Wall Street Journal if the updated is after the start of this week'],

    ['true : @com.wsj.get, section == enum(world) && updated >= start_of(mon) => notify',
    'anyone is allowed to read articles published in the world section of the Wall Street Journal if the updated is after the start of this month'],

    ['true : @com.wsj.get, section == enum(world) && updated >= start_of(year) => notify',
    'anyone is allowed to read articles published in the world section of the Wall Street Journal if the updated is after the start of this year'],

    ['true : @com.wsj.get, section == enum(world) && updated >= end_of(day) => notify',
    'anyone is allowed to read articles published in the world section of the Wall Street Journal if the updated is after the end of today'],

    ['true : @com.wsj.get, section == enum(world) && updated >= end_of(week) => notify',
    'anyone is allowed to read articles published in the world section of the Wall Street Journal if the updated is after the end of this week'],

    ['true : @com.wsj.get, section == enum(world) && updated >= end_of(mon) => notify',
    'anyone is allowed to read articles published in the world section of the Wall Street Journal if the updated is after the end of this month'],

    ['true : @com.wsj.get, section == enum(world) && updated >= end_of(year) => notify',
    'anyone is allowed to read articles published in the world section of the Wall Street Journal if the updated is after the end of this year'],

    ['true : @com.wsj.get, section == enum(world) && updated >= makeDate() + 1h => notify',
    'anyone is allowed to read articles published in the world section of the Wall Street Journal if the updated is after 1 h past now'],

    ['true : @com.wsj.get, section == enum(world) && updated >= makeDate() + 30min => notify',
    'anyone is allowed to read articles published in the world section of the Wall Street Journal if the updated is after 30 min past now'],

    ['true : @com.wsj.get, section == enum(world) && updated >= makeDate() - 30min => notify',
    'anyone is allowed to read articles published in the world section of the Wall Street Journal if the updated is after 30 min before now'],
];

const gettext = {
    locale: 'en-US',
    dgettext: (domain, msgid) => msgid
};

function test(i) {
    console.log('Test Case #' + (i+1));
    var [code, expected] = TEST_CASES[i];

    return Grammar.parseAndTypecheck(code, schemaRetriever, true).then((prog) => {
        assert(prog.isPermissionRule);
        let reconstructed = Describe.describePermissionRule(gettext, prog);

        reconstructed = reconstructed.replace('2018-5-4', '5/4/2018');

        if (expected !== reconstructed) {
            console.error('Test Case #' + (i+1) + ': does not match what expected');
            console.error('Expected: ' + expected);
            console.error('Generated: ' + reconstructed);
            if (process.env.TEST_MODE)
                throw new Error(`testDescribePolicy ${i+1} FAILED`);
        }
    }).catch((e) => {
        console.error('Test Case #' + (i+1) + ': failed with exception');
        console.error('Error: ' + e.message);
        console.error(e.stack);
        if (process.env.TEST_MODE)
            throw e;
    });
}

function loop(i) {
    if (i === TEST_CASES.length)
        return Q();

    return Q(test(i)).then(() => loop(i+1));
}

function main() {
    return loop(0);
}
module.exports = main;
if (!module.parent)
    main();
