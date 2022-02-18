const AWSXRay = require('aws-xray-sdk');
AWSXRay.setDaemonAddress('xray-service.default.svc.cluster.local:2000'); // daemon address running and deployed in the eks environment
const XRayExpress = AWSXRay.express;
const express = require('express');

// Capture all AWS clients we create
const AWS = AWSXRay.captureAWS(require('aws-sdk'));
AWS.config.update({region: process.env.DEFAULT_AWS_REGION || 'eu-west-1'});

// Capture all outgoing https requests
AWSXRay.captureHTTPsGlobal(require('https'));
const https = require('https');

const app = express();
const port = 3000;

app.use(XRayExpress.openSegment('SampleSite'));

app.get('/sample-express', (req, res) => {
  const seg = AWSXRay.getSegment();
  const sub = seg.addNewSubsegment('customSubsegment');
  setTimeout(() => {
    sub.close();
    res.sendFile(`${process.cwd()}/index.html`);
  }, 500);
});

app.get('/aws-sdk/', (req, res) => {
  const ddb = new AWS.DynamoDB();
  const ddbPromise = ddb.listTables().promise();

  ddbPromise.then(function(data) {
    res.send(`ListTables result:\n ${JSON.stringify(data)}`);
  }).catch(function(err) {
    res.send(`Encountered error while calling ListTables: ${err}`);
  });
});

app.get('/http-request/', (req, res) => {
  const endpoint = 'https://amazon.com/';
  https.get(endpoint, (response) => {
    response.on('data', () => {});

    response.on('error', (err) => {
      res.send(`Encountered error while making HTTPS request: ${err}`);
    });

    response.on('end', () => {
      res.send(`Successfully reached ${endpoint}.`);
    });
  });
});

app.get('/http-request/:id', (req, res) => {
  const endpoint = 'https://amazon.com/';
  const _q = req.query;
  const _headers = req.headers;
  const _params = req.params;
  
  https.get(endpoint, (response) => {
    response.on('data', () => {});

    response.on('error', (err) => {
      res.send(`Encountered error while making HTTPS request: ${err}`);
    });

    response.on('end', () => {
      const metaobject = {
        query_params: _q,
        headers: _headers,
        params: _params,
        reachedamazon: true
      };
      res.header("Content-Type",'application/json');
      // res.send(`Successfully reached ${req.params.id} with ${endpoint}. Includes queries: ${JSON.stringify(_q)}, & headers: ${JSON.stringify(_headers)}`);
      res.send(JSON.stringify(metaobject, null, 4));
    });
  });
});

app.use(XRayExpress.closeSegment());

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
