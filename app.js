/*
 * Starter Project for Messenger Platform Quick Start Tutorial
 *
 * Remix this as the starting point for following the Messenger Platform
 * quick start tutorial.
 *
 * https://developers.facebook.com/docs/messenger-platform/getting-started/quick-start/
 *
 */

'use strict';

// Imports dependencies and set up http server
const 
  PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN,
  request = require('request'),
  rp = require('request-promise'),
  express = require('express'),
  body_parser = require('body-parser'),
  admin = require("firebase-admin"),
  app = express().use(body_parser.json()); // creates express http server

// Fetch the service account key JSON file contents
var serviceAccount = require("./serviceAccountKey.json");

// Initialize the app with a service account, granting admin privileges
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://wild-fc8bb.firebaseio.com",
});

let db = admin.database();
let userRef = db.ref('users');

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));

// Accepts POST requests at /webhook endpoint
app.post('/webhook', (req, res) => {  

  // Parse the request body from the POST
  let body = req.body;

  // Check the webhook event is from a Page subscription
  if (body.object === 'page') {

    // Iterate over each entry - there may be multiple if batched    
    body.entry.forEach(function(entry) {
      // Get the webhook event. entry.messaging is an array, but 
      // will only ever contain one event, so we get index 0

      // Gets the body of the webhook event
      let webhook_event = entry.messaging[0];
      console.log(webhook_event);

      // Get the sender PSID
      let sender_psid = webhook_event.sender.id;
      console.log('Sender PSID: ' + sender_psid);
      
      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhook_event.message) {
        handleMessage(sender_psid, webhook_event.message);        
      } else if (webhook_event.postback) {
        handlePostback(sender_psid, webhook_event.postback);
      }
    });

    // Return a '200 OK' response to all events
    res.status(200).send('EVENT_RECEIVED');

  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }
});


// Accepts GET requests at the /webhook endpoint
app.get('/webhook', (req, res) => {
  
  /** UPDATE YOUR VERIFY TOKEN **/
  const VERIFY_TOKEN = PAGE_ACCESS_TOKEN;
  
  // Parse params from the webhook verification request
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];
    
  // Check if a token and mode were sent
  if (mode && token) {
  
    // Check the mode and token sent are correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      
      // Respond with 200 OK and challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);      
    }
  }
});


// Handles messages events
function handleMessage(sender_psid, received_message) {
  
  
  let response, nlp, url = "https://graph.facebook.com/v2.6/"+sender_psid+"?access_token="+PAGE_ACCESS_TOKEN;
  
  // request promise, waits for response in the then function
  rp({url: url, json: true})
    .then(function (data) {
      // check if data is defined, and only fb users will have first & last names
      if (data && data.first_name && data.last_name) {
        var post = {};
        post[sender_psid] = {
          first_name: data.first_name,
          last_name: data.last_name
        }
        userRef.set(post);
      }
    });
  
  // Check if the message contains text
  if (received_message.text) { 
    // Create the payload for a basic text message
//     if (received_message.nlp) {
//       nlp = received_message.nlp.entities;
//     }
//     if (nlp) {
//       console.log("NLP: ", received_message.nlp); // debug
      
//       if (nlp.location && nlp.location[0].confidence > 0.8) {
//         response = {
//           "text": "Would you like to do a pickup at " + received_message.nlp.entities.location[0].value
//         }
//       }
//       else if (nlp.greetings && nlp.greetings.confidence > 0.8) {
//         console.log("NLP[greetings]: ", received_message.nlp.entities.greetings);
//         response = {
//           "text": "Hello, please provide an image and location of your leave pickup"
//         }
//       }
//       console.log("NLP[location]: ", received_message.nlp.entities.location);
//     }
//     else {
      response = {
        "text": "Hello, please provide a location of your leave pickup",
        "quick_replies":[
          {
            "content_type":"location"
          }
        ]
      }
    // }
  } 
  else if (received_message.attachments) {
    // Get the URL of the message attachment
    let attachment_url = received_message.attachments[0].payload.url;
    response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Confirm yard waste collection posting",
            "subtitle": "Tap a button to answer.",
            "image_url": attachment_url,
            "buttons": [{
              "type": "postback",
              "title": "Post",
              "payload": "Post",
            },
            {
              "type": "postback",
              "title": "Cancel",
              "payload": "Cancel",
            }],
          }]
        }
      }
    } // end response
  } 
  // Sends the response message
  callSendAPI(sender_psid, response);    
}


// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {
  let response;
  
  // Get the payload for the postback
  let payload = received_postback.payload;

  // Set the response based on the postback payload
  if (payload === 'yes') {
    response = { "text": "Thanks!" }
  } else if (payload === 'no') {
    response = { "text": "Oops, try sending another image." }
  }
  // Send the message to acknowledge the postback
  callSendAPI(sender_psid, response);
}


// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
  // Construct the message body
  let message = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  }
  
  // Send the HTTP request to the Messenger Platform
  request({
    "uri": "https://graph.facebook.com/v2.6/me/messages",
    "qs": { "access_token": PAGE_ACCESS_TOKEN },
    "method": "POST",
    "json": message
  }, (err, res, body) => {
    if (!err) {
      console.log('message sent!')
    } else {
      console.error("Unable to send message:" + err);
    }
  }); 
}

