## This is a message generator-receiver app built on redis!

>To runt this application you need to write node app.js. 
>The first running app is a generator , then you need to open new terminal tabs and run the same app on another port simply adding PORT=YOURPORT.

>Then other running apps will be receiver.And one message can receive only one receivers.

>With 5% of chance application chooses messages and stores them in errorMessages.

>When generator is closed , one of th receivers randomly becomes generator.

>And finally if run app with parameter getErrors , app will show all errorMessages and close,removing errorMessages from database.
