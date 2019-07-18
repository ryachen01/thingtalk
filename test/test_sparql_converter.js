"use strict";

const AppGrammar = require("../lib/grammar_api");
const SchemaRetriever = require("../lib/schema");
const SparqlConverter = require("../lib/sparql_converter");
const SPARQLQueryDispatcher = require("./sparql_query");
const SparqlQuery = new SPARQLQueryDispatcher();

const _mockSchemaDelegate = require("./mock_schema_delegate");
const _mockMemoryClient = require("./mock_memory_client");
var assert = require("assert");

const _schemaRetriever = new SchemaRetriever(
  _mockSchemaDelegate,
  _mockMemoryClient,
  true
);

async function main() {
  const code = [
    `
    // Filter for person who was born on April 24, 1452 and died on December 14, 1799
    now => [person, P18] of @org.wikidata.person(), P569 == makeDate(1732, 2, 22) && P570 == makeDate(1799, 12, 14) => notify;
    `,
    `
    // Filter for person who worked at Apple, Pixar, and Next
    now => [person, P18] of @org.wikidata.person(), P108 == ["Apple", "Pixar", "NeXT Computer, Inc."] => notify;
    `,
    `
    // Filter for person whose first name is Stephen and has 3 kids
    now => [person, P18] of @org.wikidata.person(), P735 == "Stephen" && P1971 == 3=> notify;
    `,
    `
    // Filter for person whose first name is Stephen and has 3 kids
    now => [person, P18] of @org.wikidata.person(), P735 == "Stephen" && P1971 == 3=> notify;
    `
  ];
  const answers = ["George Washington", "Steve Jobs", "Stephen Curry"];

  Promise.all(
    code.map((code) => {
      let promise = new Promise((resolve, reject) => {
        code = code.trim();
        AppGrammar.parseAndTypecheck(code, _schemaRetriever).then((program) => {
          const sparqlQuery = SparqlConverter.program_to_sparql(program);
          SparqlQuery.query(sparqlQuery).then((response) => {
            let query_output =
              response["results"]["bindings"][0]["personLabel"]["value"];

            resolve(query_output);
          });
        });
      });
      return promise;
    })
  ).then((values) => {
    for (var i = 0; i < values.length; i++)
      assert.strictEqual(answers[i], values[i]);
  });
}

main();
