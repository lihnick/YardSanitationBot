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
      let webhook_event, sender_psid;
      if (entry.messaging && entry.messaging[0]) {
        webhook_event = entry.messaging[0];
        console.log(webhook_event);
        // Get the sender PSID
        sender_psid = webhook_event.sender.id;
        console.log('Sender PSID: ' + sender_psid);
      }
      else {
        console.error("Undefined Entry");
      }
      
      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhook_event) {
        if (webhook_event.message) {
          handleMessage(sender_psid, webhook_event.message);        
        } else if (webhook_event.postback) {
          handlePostback(sender_psid, webhook_event.postback);
        }
      } else {
       console.error("Undefined Webhook");
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
  // rp({url: url, json: true})
  //   .then(function (data) {
  //     // check if data is defined, and only fb users will have first & last names
  //     if (data && data.first_name && data.last_name) {
  //       userRef.child(sender_psid).update({
  //         first_name: data.first_name,
  //         last_name: data.last_name//,
  //         // lat: "lat",
  //         // lng: "lng"
  //       });
  //     }
  //   });
  
  // Check if the message contains text
  if (received_message.text) { 
    response = {
      "text": "Hello, please provide a location of your leave pickup",
      "quick_replies":[
        {
          "content_type":"location"
        }
      ]
    }
  } 
  else if (received_message.attachments) {
    // Get the URL of the message attachment
    let attachment_url = received_message.attachments[0].payload.url;
    console.log("Message Attachments: ", received_message.attachments[0]);
    
    if (received_message.attachments[0].type === 'location') {
      var loc = received_message.attachments[0].payload.coordinates;
      
      rp({url: url, json: true})
        .then(function (data) {
          // check if data is defined, and only fb users will have first & last names
          if (data && data.first_name && data.last_name) {
            // userRef.child(sender_psid+"/first_name").update(data.first_name);
            // userRef.child(sender_psid+"/last_name").update(data.last_name);
            // userRef.child(sender_psid+"/lat").update(loc.lat);
            // userRef.child(sender_psid+"/lng").update(loc.long);
            userRef.child(sender_psid).update({
              first_name: data.first_name,
              last_name: data.last_name,
              lat: loc.lat,
              lng: loc.long
            });
          }
        });
      
      response = {
        "attachment": {
          "type": "template",
          "payload": {
            "template_type": "generic",
            "elements": [{
              "title": "Confirm yard waste collection posting",
              "subtitle": "Location saved, tap a button, or add an optional image.",
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
      }
    }
    else if (received_message.attachments[0].type === 'image') {
      var img = received_message.attachments[0].payload.url;
      
      userRef.child(sender_psid).update({
        url: img
      });
      
      response = {
        "attachment": {
          "type": "template",
          "payload": {
            "template_type": "generic",
            "elements": [{
              "title": "Confirm yard waste collection posting",
              "subtitle": "Image saved, tap a button.",
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
      }
    }
    else {
      response = {
        "text": "Sorry, unable to find location data from the input"
      }
    }

     // end response
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
  if (payload === 'Post') {
    var post = userRef.child(sender_psid);
    post.once('value', function(snapshot) {
      console.log("finalize: ", snapshot.val());
      var data = snapshot.val();
      var time = {url: data.url, lat: data.lat, lng: data.lng, timestamp: Date.now()};
      post.child('posts').push(time);
    });
    response = { "text": "Thanks!" }
  } else if (payload === 'Cancel') {
    response = { "text": "Cancelling" }
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

