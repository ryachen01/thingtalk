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
    // Filter for person whose first name is Stephen and last name Curry
    now => [athlete] of @org.wikidatasportsskill.athlete(), P735 == "Stephen" && P734 == "Curry" => notify;
    `,
    `
    // Filter for person who was drafted by the cavs and won the MVP award
    now => [athlete] of @org.wikidatasportsskill.athlete(), P647 == "Cleveland Cavaliers" && P166 == "NBA Most Valuable Player Award" => notify;
    `,
    `
    // Filter for person who has played for the
    now => [athlete] of @org.wikidatasportsskill.athlete(), P54 == ["LAL"^^org.wikidatasportsskill:sports_teams("Los Angeles Lakers"), "GSW"^^org.wikidatasportsskill:sports_teams("Golden State Warriors")] => notify;
    `
  ];
  const answers = ["Stephen Curry", "LeBron James", "Wilt Chamberlain"];

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
