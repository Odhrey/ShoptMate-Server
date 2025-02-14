const mysql = require('mysql2/promise');

//Create connection pool. Pool-specific settings are the defaults 
//phone data - '192.168.171.231'
const pool = mysql.createPool({
    //change host based on the ip of the host laptop
    //192.168.171.231
    host: '192.168.1.20',
    user: 'lao2',
    password: 'gojosatoru3557',
    database: 'shopmate_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 10
});

// Define the query function
async function query(sql, params) {
    const connection = await pool.getConnection();
    try {
        const [results] = await connection.execute(sql, params);
        return results;
    } catch (err) {
        console.error('Error in query function:', err.message);
        throw err;
    } finally {
        connection.release();
    }
}

// Define the rawQuery function for non-prepared statements
async function rawQuery(sql, params) {
    const connection = await pool.getConnection();
    try {
        const [results] = await connection.query(sql, params);
        return results;
    } catch (err) {
        console.error('Error in rawQuery function:', err.message);
        throw err;
    } finally {
        connection.release();
    }
}


// Test the database connection and log the result
pool.getConnection()
    .then(connection => {
        console.log('Connected to the database');
        connection.release(); // Release the connection back to the pool
    })
    .catch(err => {
        console.error('Failed to connect to the database:', err.message);
    });

module.exports = { query, rawQuery, pool };