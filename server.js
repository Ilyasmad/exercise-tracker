const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const shortid = require('shortid')
const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MONGO_URI)

app.use(cors())

//Models
// User Schema
const Schema = mongoose.Schema;
const usersSchema = new Schema({
  username: { type: String, required: true, unique: true, maxlength: [20, 'username is too long'] },
  _id: { type: String, index: true, default: shortid.generate }
});
const User = mongoose.model('User', usersSchema);

//Exercise Schema
const exerciseSchema = new Schema({
  userId: { type: String, index: true },
  description: { type: String, required: true, maxlength: [20, 'description is too long'] },
  duration: { type: Number, required: true, min: [1, 'duration is too short'] },
  date: { type: Date, default: Date.now }
});
const Exercise = mongoose.model('Exercise', exerciseSchema);

//body-parser and link to index.html
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

//new-user api
app.post('/api/exercise/new-user', (req, res) => {
  const username = req.body.username;
  const user = new User({ username });

  user.save((err, savedUser) => {
    if (err) {
     if (err.code == 11000) {
      res.send('username already taken')
     }
      else {
        res.send('Error occured while saving user')
      }
    }
    else {
      res.json({username: savedUser.username, _id: savedUser._id})
    }
  })

});

//add api
app.post('/api/exercise/add', (req, res) => {
  const description = req.body.description;
  let duration = req.body.duration;
  let date = req.body.date;

  User.findById(req.body.userId, (err, user) => {
    if (err) {
     if (!user) {
       res.send('Username is not found')
     }
      else {
       res.send('Error while searching userId in Database')
      }
    }
    else {
      const exercise = new Exercise({ userId: user._id, description: description, duration: duration, date: date })
      exercise.save((errSave, savedExercise) => {
        if (errSave) return res.send('Error occured while saving exercise');
        res.json({username: user.username, userId: savedExercise.userId, description: savedExercise.description, duration: savedExercise.duration, date: savedExercise.date.toDateString()})
      })
    }
  })

});

//log api
app.get('/api/exercise/log', (req, res) => {
  const from = new Date(req.query.from);
  const to = new Date(req.query.to);

  User.findById(req.query.userId, (err, user) => {
    if (err) return res.send('Error while searching userId in Database');
    if (!user) res.send('No such userId in Database');

    Exercise.find(
      {userId: req.query.userId,
       date: {$lt: to != 'Invalid Date' ? to.getTime() : Date.now(),
              $gt: from != 'Invalid Date' ? from.getTime : 0}
    })
    .sort('-date')
    .limit(parseInt(req.query.limit))
    .exec((err, exercises) => {
      if (err) return res.send('Error getting exercise object from database');
      const out = {
          _id: req.query.userId,
          username: user.username,
          from : from != 'Invalid Date' ? from.toDateString() : undefined,
          to : to != 'Invalid Date' ? to.toDateString(): undefined,
          count: exercises.length,
          log: exercises.map(e => ({
            description : e.description,
            duration : e.duration,
            date: e.date.toDateString()
          })
        )
      }
      res.json(out)
    })
  })
});

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
