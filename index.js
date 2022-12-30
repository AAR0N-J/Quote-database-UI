const express = require("express");
const mysql = require('mysql');
const app = express();
const pool = dbConnection();
const bcrypt = require('bcrypt');
const session = require('express-session');

app.set("view engine", "ejs");
app.use(express.static("public"));
//to parse Form data sent using POST method
app.use(express.urlencoded({extended: true}));

app.set('trust proxy', 1) // trust first proxy
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true }
}))

//routes
app.get('/', (req, res) => {
  res.render('login');
});

app.get('/logout', (req, res) => {
   req.session.destroy();
   res.redirect('/');
});

app.get('/home', isAuthenticated, (req, res) => {
  res.render('home');
});

app.post('/login', async (req, res) => {
   let username = req.body.username;
   let password = req.body.password;
   let passwordHash = "";

   let sql = `SELECT password
              FROM q_admin
              WHERE username =  ?`;
   let rows = await executeSQL(sql, [username]);
   if (rows.length > 0){ // username was found in database!
      passwordHash = rows[0].password;
   }
   const match = await bcrypt.compare(password, passwordHash);
   if(match){
     req.session.authenticated = true;
     res.render('home');
   } else {
     res.render('login', {"error": "Wrong Credentials!"});
   }
});

app.get('/addAuthor', isAuthenticated, (req, res) => {
  res.render('addAuthor');
});

app.get('/updateAuthor', isAuthenticated, async (req, res) => {
  let authorId = req.query.id;
  let sql = `SELECT *, DATE_FORMAT(dob, '%Y-%m-%d') ISOdate,  DATE_FORMAT(dod, '%Y-%m-%d') ISOdate1
              FROM q_authors
              WHERE authorId = ?`;
  let rows = await executeSQL(sql, [authorId]);
  res.render('updateAuthor', { "authorInfo": rows });
});

app.get('/updateQuote', isAuthenticated, async (req, res) => {
  let quoteId = req.query.id;
  let sql = `SELECT *
            FROM q_quotes
            WHERE quoteId = ?`
  let rows = await executeSQL(sql, [quoteId]);
  sql = `SELECT authorId, firstName, lastName
         FROM q_authors
         ORDER BY lastName`;
  let rows2 = await executeSQL(sql);
  sql = `SELECT DISTINCT category
         FROM q_quotes`;
  let rows3 = await executeSQL(sql);
  res.render('updateQuote', { "quoteInfo": rows, "authors": rows2, "categories": rows3 });
});

app.post('/updateAuthor', isAuthenticated, async (req, res) => {
  let firstName = req.body.firstName;
  let lastName = req.body.lastName;
  let bio = req.body.bio;
  let dob = req.body.dob;
  let dod = req.body.dod;
  let authorId = req.body.authorId;
  let country = req.body.country;

  let sql = `UPDATE q_authors
              SET 
                firstName = ?,
                lastName = ?,
                dob = ?,
                dod = ?,
                country = ?,
                biography = ?
              WHERE authorId = ?`;
  let params = [firstName, lastName, dob, dod, bio, country, authorId];
  let rows = await executeSQL(sql, params);
  res.redirect('/listAuthors');
});

app.get('/deleteAuthor', isAuthenticated, async (req, res) => {
  let authorId = req.query.id;
  let sql = `DELETE FROM q_authors
             WHERE authorId = ?`
  let rows = await executeSQL(sql, [authorId]);
  res.redirect('/listAuthors');
});


app.post('/updateQuote', isAuthenticated, async (req, res) => {
  let quoteId = req.body.quoteId;
  let quote = req.body.quote;
  let authorId = req.body.authorId;
  let category = req.body.category;
  let likes = req.body.likes

  let sql = `UPDATE q_quotes
              SET 
              quote = ?,
              authorId = ?,
              category = ?,
              likes = ?
              WHERE quoteId = ?`;
  let rows = await executeSQL(sql, [quote, authorId, category, likes, quoteId]);
  res.redirect('/updateQuote?id=' + quoteId);
});

app.get('/listAuthors', isAuthenticated, async (req, res) => {

  let sql = `SELECT authorId, firstName, lastName
              FROM q_authors
              ORDER BY lastName`;
  let rows = await executeSQL(sql);


  res.render('authors', { "authors": rows });
});

app.get('/deleteQuote', isAuthenticated, async (req, res) => {
  let quoteId = req.query.id;
  let sql = `DELETE FROM q_quotes
             WHERE quoteId = ?`
  let rows = await executeSQL(sql, [quoteId]);
  res.redirect('/listQuotes');
});

app.get('/listQuotes', isAuthenticated, async (req, res) => {
  let sql = `SELECT quoteId, quote
              FROM q_quotes
              ORDER BY quote`;
  let rows = await executeSQL(sql);
  res.render('quotes', { "quotes": rows });
});

app.post('/addAuthor', isAuthenticated, async (req, res) => {
  let firstName = req.body.firstName;
  let lastName = req.body.lastName;
  let bio = req.body.bio;
  let dob = req.body.dob;
  let dod = req.body.dod;
  let sex = req.body.sex;
  let country = req.body.country;
  let profession = req.body.profession;
  let portrait = req.body.portrait;

  let sql = `INSERT INTO q_authors
              (firstName, lastName, dob, dod, sex, profession, country, portrait, biography)
              VALUES
              (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  let params = [firstName, lastName, dob, dod, sex, profession, country, portrait, bio];
  // console.log(firstName);
  let rows = await executeSQL(sql, params);
  res.render('addAuthor');
});

app.get('/addQuote', isAuthenticated, async (req, res) => {
  let sqla = `SELECT firstName, lastName, authorId
             FROM q_authors
             ORDER BY lastName`;
  let sqlq = `SELECT DISTINCT category
             FROM q_quotes`;
  let rows = await executeSQL(sqla);
  let cat = await executeSQL(sqlq);
  res.render('addQuote', { "authors": rows, "category": cat });
});

app.post('/addQuote', isAuthenticated, async (req, res) => {
  let quote = req.body.quote;
  let category = req.body.quote;
  let authorId = req.body.author;
  
  let sql = `INSERT INTO q_quotes
              (quote, authorId, category)
              VALUES
              (?, ?, ?)`;

  let params = [quote, authorId, category];
  // console.log(firstName);
  let rows = await executeSQL(sql, params);
  res.render('addQuote');
});


app.get("/dbTest", async function(req, res) {
  let sql = "SELECT CURDATE()";
  let rows = await executeSQL(sql);
  res.send(rows);
});//dbTest

//functions

// middleware functions 
function isAuthenticated(req, res, next){
  if (req.session.authenticated){
     next();
   } else {
     res.redirect('/');
   }
}

async function executeSQL(sql, params) {
  return new Promise(function(resolve, reject) {
    pool.query(sql, params, function(err, rows, fields) {
      if (err) throw err;
      resolve(rows);
    });
  });
}//executeSQL
//values in red must be updated
function dbConnection() {

  const pool = mysql.createPool({

    connectionLimit: 10,
    host: "cwe1u6tjijexv3r6.cbetxkdyhwsb.us-east-1.rds.amazonaws.com",
    user: "nstwa3r82fbmw3bw",
    password: "z26ca8fd64u3m9xb",
    database: "x1akpmooqm7zd50u"


  });

  return pool;

} //dbConnection

//start server
app.listen(3000, () => {
  console.log("Expresss server running...")
})


