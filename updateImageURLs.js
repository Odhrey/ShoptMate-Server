const mysql = require('mysql2/promise');
const path = require('path');

// Create connection pool
const pool = mysql.createPool({
    host: '192.168.1.17',
    user: 'lao2',
    password: 'gojosatoru3557',
    database: 'shopmate_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
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

// Function to extract file ID from Google Drive URL
function extractFileId(driveUrl) {
    const url = new URL(driveUrl);
    return url.searchParams.get('id');
}

// Function to update image URLs in the database
async function updateImageURLs() {
    const oldBaseURL = 'https://drive.google.com/uc?export=view&id=';
    const newBaseURL = 'http://localhost:3000/productImages/';

    try {
        // Retrieve all products with their current image URLs
        const products = await query('SELECT barcode_id, product_image FROM Products');

        // Update each product's image URL
        for (const product of products) {
            // Extract the Google Drive ID from the old URL
            const driveId = extractFileId(product.product_image);

            if (driveId) {
                // Generate the new image URL assuming the local filenames are the same as the Drive IDs
                const newImageURL = `${newBaseURL}${driveId}.png`;

                // Update the image URL in the database
                await query('UPDATE Products SET product_image = ? WHERE barcode_id = ?', [newImageURL, product.barcode_id]);
            }
        }

        console.log('Image URLs updated successfully!');
    } catch (error) {
        console.error('Error updating image URLs:', error.message);
    }
}

// Call the updateImageURLs function to perform the update
updateImageURLs();

// Export the pool and query function if needed in other parts of your application
module.exports = { query, pool };