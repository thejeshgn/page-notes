const levelgraph = require('levelgraph');
const leveljs = require('level-js');
const levelup = require('levelup');
const levelgraphJSONLD = require('levelgraph-jsonld');

const PouchDB = require('pouchdb-browser');

const db = new PouchDB('page-notes');

const index = levelgraphJSONLD(
  levelgraph(
    levelup('page-notes-index', {
      db: (location) => new leveljs(location)
    })
  )
);
window.index = index;

// Promise returns a Web Annotation Container
function getAllAnnotations() {
  return db.allDocs({include_docs: true})
    .then(function(results) {
      var annotations = {
        '@context': 'http://www.w3.org/ns/anno.jsonld',
        // TODO: ...how do we make this actually universal?
        // ...user is not yet identified
        // ...we can get at Platform Arch/OS info https://developer.chrome.com/extensions/runtime#type-PlatformInfo
        // ...it certainly can't stay like this...can it?
        id: 'urn:page-notes:collections:default',
        type: 'AnnotationCollection',
        items: []
      };

      if ('rows' in results) {
        results.rows.forEach(function(row) {
          if ('doc' in row && row.doc.type === 'Annotation') {
            annotations.items.push(row.doc);
          }
        });
      }
      return annotations;
    });
}


// returns a promise or error logs
// TODO: rename this to getPageNotes
function getAnnotations(target) {
  return db
    .find({
      selector: {
        target: target
      }
    })
    .catch(console.error.bind(console));
}

// returns a promise or error logs
function getHighlights(target) {
  return db
    .find({
      selector: {
        'target.source': target
      }
    })
    .catch(console.error.bind(console));
}

// returns the PouchDB promise
function storeAnnotation(annotation) {
  // construcut unique collation friendly id (for _id & id)
  // TODO: find a better URN to keep this stuff in
  // assume annotation.target is an IRI if .source is missing
  let target_iri = annotation.target.source || annotation.target;
  let id = 'urn:page-notes:'
    + encodeURI(target_iri)
    + ':' + (new Date).toISOString();

  annotation._id = id;
  annotation.id = id;

  console.log('stored annotation', JSON.stringify(annotation));

  return db.put(annotation)
    .then((response) => {
      console.log('stored?', response);
      // now that the annotation is stored, let's index it
      indexAnnotation(annotation);
    });
}

function indexAnnotation(annotation) {
  index.jsonld.put(annotation, (err, obj) => {
    if (err) console.error('levelgraph-jsonld error', err);
    console.log('indexed!', obj);
  });
}

function reindexAllAnnotations() {
  getAllAnnotations()
    .then(function(rv) {
      if ('items' in rv) {
        console.log('indexing all the things!', rv.items.length);
        rv.items.forEach(annotation => {
          console.log('indexing', annotation);
          indexAnnotation(annotation);
        });
      }
    });
}

window.reindexAllAnnotations = reindexAllAnnotations;

module.exports.getAllAnnotations = getAllAnnotations;
module.exports.getAnnotations = getAnnotations;
module.exports.getHighlights = getHighlights;
module.exports.storeAnnotation = storeAnnotation;
