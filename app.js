const express = require('express');
const redis = require('redis');
const faker = require('faker');
const bodyParser = require('body-parser');
const app = express();
const client = redis.createClient();
const port = process.env.PORT || 8080;

// Configuring redis
client.select(1);
client.on("error", function (err) {
    console.log("Redis Error " + err);
});
app.use(bodyParser.json());

process.stdin.resume();

//Flag getErrors 
if(process.env.getErrors) {
    client.get('errorMessages', (err, val) => {
        let errorMessages = JSON.parse(val);
        errorMessages.map((item) => {
            console.log(item);
        })
        client.flushdb((err, rep) => {
            if(err) return console.log(err);
            console.log(reply);
        })
        process.exit();
    })
}


// Self made function for comparing 2 arrays
const compareArrays = (arr1, arr2) => {
    if(arr1.length !== arr2.length) return false;
    const length = arr1.length;
    for(let i = 0; i < length; ++i) {
        if(arr1[i] !== arr2[i]) return false;
    }

    return true;
}

// Function for generating messages via faker
const generateMsg = (ids, selfID) => {
    //Picking up all receivers that are still running
    let recIDs = ids.filter((item) => {
        return item !== selfID && item !== null
    });

    // Picking up random receiver from receivers list
    if(recIDs.length != 0) {
        let ind = Math.floor(Math.random() * recIDs.length);
        const msg = {
            text: faker.lorem.sentence(),
            id: recIDs[ind]
        };

        if(selfID != recIDs[ind]) {
            client.set(msg.id, JSON.stringify(msg));
        }
    }
    
}

//Receiver function
let prevmsg = '';
const receiveMSG = (clientID) => {
    client.get(clientID, (err, val) => {
        const msg = JSON.parse(val);
        if(msg && prevmsg !== msg.text) {
            
            let errorMessage = msg.text;
            
            //Errors checking and saving in redis
            if (Math.random() * 100 < 5) {
                client.get('errorMessages', (err, val) => {
                    let errorMessages;
                    if(val === null) {
                        errorMessages = [];
                    } else {
                        errorMessages = JSON.parse(val);
                    }
                    errorMessages.push(errorMessage);
                    client.set('errorMessages', JSON.stringify(errorMessages));
                })
            }
            console.log(msg.text);
            prevmsg = msg.text.slice(0);
        
        }
    })
}

//Exit event listener
const onExit = (ids, currID, isGen, runningCount) => {
    //If last instance of program is running clear db , only saving errorMessages
    if(runningCount == 1) {
        client.get('errorMessages', (err, val) => {
            let errorMessages = JSON.parse(val);
            client.flushdb((err, reply) => {
                if(err) return console.log(err);
                console.log(reply);
                client.set('errorMessages', JSON.stringify(errorMessages));
                process.exit();
            })
            
        })
     return;
    }
    //If current instance is generator, randomly pick another generator
    if(isGen) {
        let index;
        do {
            index = Math.floor(Math.random() * (ids.length));
        } while(ids[index] === null || ids[index] === currID)
        client.set('genID', ids[index]);
    }
    //Change ids array in redis
    const index = ids.indexOf(currID);
    if(index !== -1) {
        ids[index] = null;
        client.set('ids', JSON.stringify(ids));
    }

    client.set('running', runningCount-1);
    process.exit();
}

let isGenerator = false;
let ids, genID;
let prevIDs = [], prevGen = -1;
let id;


client.get('running', (err, val) => {
    let running = Number(val);
    client.set('running', ++running);

    //If its the first instance , make it generator
    if(running == 1) {
        isGenerator = true;
        let ids = [];
        client.set('ids', JSON.stringify(ids)); 
    }

    //Interval for 500ms for generating and reading messages
    setInterval(() => {
        client.get('ids', (err, val) => {
            ids = JSON.parse(val);
            //Picking up id for current sample
            if(!id) {
                id = ids.length + 1;
                ids.push(id);
                client.set('ids', JSON.stringify(ids));
            }
            running = ids.filter((item, index) => { return item != null}).length;
            
            //Saving generator ID in redis
            if(isGenerator) {
                client.set('genID', id)
            }
            client.get('genID', (err, val) => {
                genID = Number(val);
                //Checking if current sample became generator
                if(!isGenerator && id == genID) {
                    isGenerator = true;
                }
                
                if(isGenerator) {
                    console.log('Im a generator')
                    generateMsg(ids, genID);
                    //Adding event listener both for generator and receiver, and changing them when IDs were changed
                    if(!compareArrays(prevIDs, ids) || genID !== prevGen) {
                        process.on('exit', () => { onExit(ids, id, true, running)});
                        process.on('SIGINT', () => { onExit(ids, id, true, running)});
                        process.on('SIGUSR1', () => { onExit(ids, id, true, running)});
                        process.on('SIGUSR2', () => { onExit(ids, id, true, running)});
                        process.on('uncaughtException', () => { onExit(ids, id, true, running)});
                        prevIDs = ids.slice(0);
                        prevGen = genID;
                    }
                } else {
                    receiveMSG(id);
                    if(!compareArrays(prevIDs, ids) || genID !== prevGen) {
                        process.on('exit', () => { onExit(ids, id, false, running)});
                        process.on('SIGINT', () => { onExit(ids, id, false, running)});
                        process.on('SIGUSR1', () => { onExit(ids, id, false, running)});
                        process.on('SIGUSR2', () => { onExit(ids, id, false, running)});
                        process.on('uncaughtException', () => { onExit(ids, id, false, running)});

                        prevIDs = ids.slice(0);
                        prevGen = genID;
                    }
                }

                
            });
        });
       
    }, 500);

});

app.listen(port, (err) => {
    if(err){
        console.log(err);
    } else {
        console.log(`The server is up on port ${port}`);
    }
})