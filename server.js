const express = require('express');
const bodyParser = require('body-parser');
const { query, rawQuery, pool } = require('./db'); 
const JsBarcode = require('jsbarcode');
const { createCanvas } = require('canvas');

const app = express();
const port = 3000;

app.use(bodyParser.json());

if (!pool) {
    console.error('Pool is not defined');
}

// Function to generate barcode image
const generateBarcode = (barcode) => {
    const canvas = createCanvas();
    JsBarcode(canvas, barcode, {
        format: 'EAN13',
        lineColor: '#000000',
        width: 2,
        height: 100,
        displayValue: true
    });
    return canvas.toDataURL(); // Return the image as a Data URL
};

//**********SERVER CONNECTION ROUTES************

// PING SERVER
// Endpoint to verify if the server is reachable and operational
app.get('/ping', (req, res) => {
    res.status(200).send('Ping');
});
//----------------------------------------------------------------------------------------------------------------------------------------------
// RETRIEVE IP ADDRESS
// Endpoint to retrieve the current IP address of the server host
app.get('/ip-address', (req, res) => {
    console.log('IP ADDRESS - Received request to retrieve IP Address\n');
    res.status(200).json({ IPAddress: 'http://192.168.1.22:3000/' });
});

//**********AUTHENTICATION ROUTES**************

// REGISTRATION
// Endpoint to handle user registration by using the AddUser stored procedure 
// Ensures the username is unique before creating a new record
app.post('/registration/user/name/password/role', async (req, res) => {
    // Extract the userName, userPassword, and userRole from the request body
    const { userName, userPassword, userRole } = req.body;
    console.log(`REGISTRATION - Received request TO ADD TO NEW USER TABLE:\n Username: ${userName}\n Password: ${userPassword}\n Role: ${userRole}`);

    try {
        // Query the database to check if the username already exists
        const existingUsername = await query('SELECT username FROM Users WHERE username = ?', [userName]);
        
        // Retrieve the username from the database
        const username = existingUsername[0]?.username;
    
        // Check if the username already exists (case-insensitive)
        if (username && username.toLowerCase() === userName.toLowerCase()) {
            console.log('REGISTRATION - Username already exists\n');
            res.json({ message: 'Username already exists' }); 
            return;// Exit early since the username already exists
        }
    
        // Add a new user using the stored procedure 'AddUser'
        const result = await query('CALL AddUser(?, ?, ?)', [userName, userPassword, userRole]);
    
        // Extract the newly created user_id from the result
        const newUserID = result[0][0]?.user_id;
        console.log('New User ID:', newUserID,'\n');
    
        if (newUserID) {
            // User registration successful, respond with success message
            res.json({ message: 'User registered successfully' });
        } else {
            // Handle unexpected failure to create the user
            console.log('REGISTRATION - Failed to add user\n');
            res.json({ message: 'Failed to add user' });
        }
    } catch (error) {
        // Log the error for debugging purposes
        console.error('Error during user registration:', error,'\n');
    
        // Respond with a generic error message
        res.json({ message: 'Error during registration' });
    }
    
});
//----------------------------------------------------------------------------------------------------------------------------------------------
// LOG IN
// Endpoint to handle user login by validating the username and role against the 'Users' table
// If the user exists, it checks the password for authentication
app.post('/login/user/name/role', async (req, res) => {
    // Extract the userName and userRole from the request body
    const { userName, userRole } = req.body;
    console.log(`LOG IN - Received request TO CHECK USER TABLE:\n Username: ${userName}\n Role: ${userRole}`);

    try {
        // Query the database to check if a user exists with the given username and role
        const result = await query('SELECT user_id, password_hash FROM Users WHERE username = ? AND role_name = ?', [userName, userRole]);

        // If a user is found, return their user_id and password_hash
        if (result.length > 0) {
            const existingUser = result[0];  // Get the first matching user from the result
            console.log('Existing password and user ID: ', existingUser,'\n');

            // Respond with the user's ID and password hash for further validation in the app
            res.json({ user_id: existingUser.user_id, password_hash: existingUser.password_hash });
        } else {
            // If no user matches, log the result and send a 404 status code
            console.log('User not found: ', result, '\n');
            return res.sendStatus(404);
        }
    } catch (err) {
        // Log and respond with a 500 error 
        console.error(`LOG IN - Error checking user: ${err.message}\n`);
        res.status(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------
// CHANGE PASSWORD
// Endpoint to handle changing a user's password by using the CreatePasswordReset stored procedure
// Updates the password in the Users table based on the provided username
app.post('/login/user/change/password', async (req, res) => {
    // Extract the userName and userPassword from the request body
    const { userName, userPassword } = req.body;
    console.log(`CHANGE PASSWORD - Received request TO CHECK USER TABLE:\n username: ${userName}\n password: ${userPassword}`);

    try {
        // Query the database to check if the user exists based on the provided username
        const result = await query('SELECT user_id FROM Users WHERE username = ?', [userName]);

        if (result.length > 0) {
            // If the user exists, retrieve their user_id
            const existingUserID = result[0]?.user_id;  

            // Call the stored procedure to update the password for the user
            const results = await query('CALL CreatePasswordReset(?, ?)', [existingUserID, userPassword]);
            console.log('CHANGE PASSWORD - Existing user ID:', existingUserID,'\n');

            // Respond with a success message indicating the password has been changed
            res.json({ message: 'Password changed successfully' });
        } else {
            // If the user does not exist, respond with a 404 error and appropriate message
            console.log('CHANGE PASSWORD - User not found:', result,'\n');
            res.status(404).json({ message: 'User does not exist' });
        }
    } catch (err) {
        // Log and respond with a 500 error
        console.error(`CHANGE PASSWORD - Error checking user: ${err.message}\n`);
        res.status(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------
// DASHBOARD CARD USER ID 
// Endpoint to retrieve the userID for the dashboard card
app.post('/dashboard/user-card/userID', async (req, res) => {
    // Extract the userName and userRole from the request body
    const { userName, userRole } = req.body;
    console.log(`DASHBOARD CARD USER ID - Received request TO RETRIEVE USER ID for this user: ${userName}, userRole: ${userRole}`);

    try {
        // Retrieve user ID for the user
        const result = await query('SELECT user_id FROM Users WHERE username = ? AND role_name = ?', [userName, userRole]);

        if (result.length > 0) {
            const userID = result[0]?.user_id;  // Get the first user
            console.log('Retrieved user ID:', userID,'\n');
            res.json({ user_id: userID});
        } else {
            res.status(404).json({ message: 'User ID not found' });
        }
    } catch (err) {
        // Log and respond with a 500 error
        console.error(`Error checking user: ${err.message}\n`);
        res.status(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------

//**********ADMIN ROUTES************

// LATEST CATEGORIES
// Endpoint to retrieve the latest categories from the Categories table
// Used for populating the category spinner in the application
app.get('/admin/latest/categories', async (req, res) => {
    try {
        // Query the Categories table to retrieve all category names
        const result = await query('SELECT category_name FROM Categories')
      
        // Check if any categories are found
        if (result.length > 0) {
            // Commented out logging for the result; can be enabled for debugging if needed
            //console.log('Result: ', result, '\n'); 

            // Respond with the result (categories)
            res.json({ result })
        } else {
            // Handle the case where no categories are found 
            console.log('No categories found\n');
            res.json({ result: [] }); // Respond with an empty array
        } 
    } catch (err) {
        // Log and respond with a 500 error
        console.error('Error retrieving categories:', err.message,'\n');
        res.status(500).json({ error: err.message });                                                                          
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------
// NEW CATEGORY
// Endpoint to add a new category using the AddCategory stored procedure
// Adds a new category to the Categories table
app.post('/admin/categories', async (req, res) => {
    // Extract category name from query parameters
    const { category }= req.query;
    console.log('NEW CATEGORY - Received request TO ADD THIS CATEGORY:', category);

    try {
        // Check if category already exists in the Categories table
        const existingCategory = await query('SELECT category_name FROM Categories WHERE category_name = ?', [category]);
      
            if (existingCategory.length > 0) {
            console.log('Category exists:', existingCategory,'\n');
            res.json({ message: 'Category already exists' })
        } else {
            // Insert new category using the stored procedure
            await query('CALL AddCategory(?)', [category]);
            console.log('NEW CATEGORY - Category added\n');
            res.json({ message: 'New category added' });
        } 
    } catch (err) {
        // Log and respond with a 500 error
        console.error('Error adding category:', err.message,'\n');
        res.status(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------
//Initialize addProduct procedure in the server
async function addProduct(barcodeNumber, barcodeImage, productName, categoryName, price, weight, weightUnit, Quantity) {
    const queryStr = 'CALL AddProduct(?, ?, ?, ?, ?, ?, ?, ?)';
    try {
        console.log('Executing Query:', queryStr, [barcodeNumber, productName, categoryName, price, weight, weightUnit, Quantity]);
        return { barcodeImage: barcodeImage, name: productName, category: categoryName, price: price, weight: weight, quantity: Quantity, weight_unit: weightUnit};
    } catch (err) {
        console.error('Error executing query:', err.message);
        console.error('Full error details:', err);
        throw err;
    }
}
//----------------------------------------------------------------------------------------------------------------------------------------------
// NEW PRODUCT
// Endpoint to handle the addition of a new product by using AddProduct stored procedure
// Adds new product to products table based on admin input
app.post('/admin/products', async (req, res) => {
    // Extract necessary product information from query body
    const { name, weight, price, category, weight_unit, barcode_id, quantity } = req.body;
    console.log('NEW PRODUCT - Received Data:', req.body,'\n');

    try {
        // Generate barcode image
        const barcode_image = generateBarcode(barcode_id);
    
        // Call the addProduct function
        const result = await addProduct(barcode_id, barcode_image, name, category, price, weight, weight_unit, quantity);

        // Log success
        console.log('NEW PRODUCT - Product Added\n');

        // Send the full result as the response 
        res.json(result);
    } catch (err) {
        console.error('Full error details:', err,'\n');
        res.status(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------
// SALES REPORT
// Endpoint to retrieve the report ID for a specific date using the GetSalesDataByDate stored procedure
app.post('/admin/sales-report/one-date', async (req, res) => {
    // Extract userID and startDate from query parameters
    const { userID, startDate } = req.query;
    console.log(`SALES REPORT - Received request TO RETRIEVE REPORT ID for this date: ${startDate} with userID: ${userID}`);

    // Validate startDate
    if (!startDate) {
        console.error('SALES REPORT - Start/end date is required\n');
        return res.status(400).json({ error: 'Start/end date is required' });
    }

    try {
        // Call the stored procedure to get the sales report ID for the specified user and date
        const result = await query('CALL GetSalesDataByDate(?, ?)', [userID, startDate]);

        // Extract report ID from the query result
        const reportID = result[0][0]?.report_id; 

        // Log and send the report ID in the response
        console.log(`SALES REPORT - Sending report_id: ${reportID}\n`);
        res.json({ reportID });
    } catch (err) {
        // Log the error and send a 500 response
        console.error('Error fetching receipt items:', err.message,'\n');
        res.status(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------
// SALES REPORT ITEMS
// Endpoint to retrieve items from the SalesReportItems table for a specific report ID 
app.get('/admin/sales-report/one-date/items', async (req, res) => {
    // Extract reportID from query parameters
    const { reportID } = req.query;
    console.log(`SALES REPORT ITEMS - Received request TO GET REPORT ITEMS for this report ID: `, reportID);

    // Validate if reportID is provided
    if (!reportID) {
        console.error('SALES REPORT ITEMS - ReportID is required\n');
        return res.status(400).json({ error: 'ReportID is required' });
    }

    try {
        // Query the database to fetch report items based on report ID
        const result = await query('SELECT product_name, quantity_sold, price_unit, total_sales FROM SalesReportItems WHERE report_id = ?', [reportID]);

        // Log and send the result in the response
        console.log(`SALES REPORT ITEMS - Fetched successfully for receipt number: ${reportID}\n`);
        res.json(result);
    } catch (err) {
        // Log the error and send a 500 response
        console.error('Error fetching report details:', err,'\n');
        res.status(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------
// SALES REPORT 2
// Endpoint to retrieve report ID for two dates using the GetSalesData stored procedure
app.post('/admin/sales-report/two-dates', async (req, res) => {
    // Extract userID, startDate, and endDate from query parameters
    const { userID, startDate, endDate } = req.query;
    console.log(`SALES REPORT 2 - Received request TO RETRIEVE REPORT ID for these dates: ${startDate} - ${endDate} with userID: ${userID}`);

    // Validate that startDate and endDate are provided
    if (!startDate || !endDate) {
        console.error('SALES REPORT - Start/end date is required\n');
        return res.status(400).json({ error: 'Start/end date is required' });
    }

    try {
        // Call the stored procedure to fetch the report ID for the given user and date range
        const result = await query('CALL GetSalesData(?, ?, ?)', [userID, startDate, endDate]);

        // Extract report ID from the first row of the result set
        const reportID = result[0][0]?.report_id;

        // Log and respond with the retrieved report ID
        console.log(`SALES REPORT 2 - Sending report_id: ${reportID}`,'\n');
        res.json({ reportID });
    } catch (err) {
        // Log the error and send a 500 response
        console.error('Error fetching receipt items:', err,'\n');
        res.status(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------
// SALES REPORT ITEMS 2
// Endpoint to retrieve items from the ReportProducts table for a specific report ID 
app.get('/admin/sales-report/two-dates/items', async (req, res) => {
    // Extract reportID from query parameters
    const { reportID } = req.query;
    console.log(`SALES REPORT ITEMS 2 - Received request TO GET REPORT ITEMS for this report ID: ${reportID}`);

    // Validate if reportID is provided
    if (!reportID) {
        console.error('SALES REPORT ITEMS 2 - ReportID is required\n');
        return res.status(400).json({ error: 'ReportID is required' });
    }

    try {
        // Query the database to fetch report items based on report ID
        const result = await query('SELECT product_name, quantity_sold, price_unit, total_sales FROM ReportProducts WHERE report_id = ?', [reportID]);

        // Log and send the result in the response
        console.log(`SALES REPORT ITEMS 2 - Receipt items fetched successfully for receipt number: ${result}\n`);

        // Log and send the result in the response
        console.log(`SALES REPORT ITEMS 2 - Receipt items fetched successfully for receipt number: ${reportID}\n`);
        res.json(result);
    } catch (err) {
        // Log the error and send a 500 response
        console.error('Error fetching receipt items:', err,'\n');
        res.status(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------
// REPORT HISTORY
// Endpoint to retrieve the history of reports accessed by a specific user
app.get('/admin/report-history', async(req, res) => {
    // Extract the user ID from the query parameters
    const { userID } = req.query;
    console.log(`REPORT HISTORY - Received request TO RETRIEVE REPORT HISTORY ITEMS for this userID: ${userID}\n`);

    try {
        // Query the database for report history items associated with the user ID
        const result = await query('SELECT report_id, accessed_at FROM UserReportAccess WHERE user_id = ?', [userID]);

        // Send the result as a JSON response
        res.json(result);
    } catch (err) {
        // Log the error and send a 500 response
        console.error('REPORT HISTORY - Error report history: ', err.message,'\n');
        res.status(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------
// USER RECORD
// Endpoint to retrieve user record from Users table
app.get('/admin/user-record', async(_, res) => {
    try {
        // Query the database to fetch user records
        const result = await query('SELECT user_id, username, role_name FROM Users');

        // Uncomment the following line if there's a need to log the retrieved result for debugging or verification purposes
        //console.log('Result: ', result,'\n');

        // Send the result as a JSON response
        res.json(result);
    } catch (err) {
        // Log the error and send a 500 response
        console.error('USER RECORD - Error fetching user records: ', err.message,'\n');
        res.status(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------
// REMOVE USER
// Endpoint for removing a user using DeleteUser stored procedure
app.post('/admin/remove-user', async (req, res) => {
    // Extract the user ID from the query parameters
    const { userID } = req.query;
    console.log('REMOVE USER - Received request TO DELETE user: ', userID);

    try {
        // Call the stored procedure to delete the user
        const result = await query('CALL DeleteUser(?)', [userID]);

        // Log the results
        console.log('REMOVE USER - User deleted successfully\n');

        // Send success response
        res.json({ message: 'User removed' });
    } catch {
        // Log the error and send a 500 response
        console.error('Error removing user: ', err.message,'\n');
        res.json(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------
// VIEW PRODUCT
// Endpoint for retrieving product details based on the category
app.get('/admin/latest/product', async (req, res) => {
    // Extract the category from the query parameters
    const { category } = req.query;
    console.log(`VIEW PRODUCT - Received request TO GET PRODUCTS for this category: ${category}`);
    
    try {
        // Query the database to retrieve products belonging to the specified category
        const results = await query('SELECT * FROM Products WHERE category_name = ?', [category]); 

        // Check if any products were found for the given category
        if (results.length > 0) {
            // Map through results and include only desired fields
            const filteredResults = results.map(product => ({
                product_name: product.product_name,
                price: product.price,
                weight: product.weight,
                weight_unit: product.weight_unit,
                quantity: product.quantity,
            }));
    
            // Log and return the filtered list of products      
            console.log('VIEW PRODUCT - Category has products\n');
            res.json(filteredResults);
        } else {
            // Log and return an empty array if no products match the category
            console.log('VIEW PRODUCT - No products found for this category\n');
            res.json([]);
        }
    } catch (err) {
        // Log the error with additional stack trace details for debugging
        console.error('Error retrieving products with cateogry: ', category, 'Message: ', err.message,'\n');
        console.error('Error Stack:', err.stack,'\n');

        // Send a 500 status response with the error message
        res.status(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------

//***************SHOPPER ROUTES**************

// SHOPPING SESSION ID
// Endpoint for creating a new shopping session using CreateShoppingSession stored procedure
// Or retrieving an active session ID
app.post('/shopper/create-session', async (req, res) => {
    // Extract the user ID from the query parameters
    const { userID }= req.query;
    console.log('SHOPPING SESSION - Received request TO CREATE SESSION for this userID:', userID);

    try {
        // Query the database to check for existing shopping sessions for the user
        const result = await query('SELECT session_id, status FROM ShoppingSessions WHERE user_id = ?', [userID]);
        
        // Check if there's any active session among the existing sessions
        const activeSession = result.find(session => session.status === 'active');
        
        if (activeSession) {
            // If an active session exists, return it
            console.log('SHOPPING SESSION - Existing active session ID:', activeSession.session_id,'\n');
            return res.json({ session_id: activeSession.session_id });
        }

        // No active sessions found (or no session exist), create a new session using the stored procedure
        const [newSessionResult] = await query('CALL CreateShoppingSession(?)', [userID]);

        // Extract the newly created session ID
        const newSessionID = newSessionResult[0]?.session_id;
        if (newSessionID) {
            console.log('SHOPPING SESSION - New session ID:', newSessionID,'\n');
            res.json({ session_id: newSessionID });
        } 

        // Throw an error if creating new cartID fails
        throw new Error('Failed to generate a new session ID');
        
    } catch (err) {
        // Log the error and send a 500 response
        console.error('Error creating session:', err.message,'\n');
        res.status(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------
// CART ID
// Endpoint for creating a cart ID using CreateCart stored procedure
// Creates a new cart ID if there's no active cart ID; else retrieves the existing cart ID
app.post('/shopper/create-cart', async (req, res) => {
    // Extract the session ID from the query parameters
    const { sessionID } = req.query;
    console.log('CART ID - Received request TO CREATE CART ID for this sessionID:', sessionID);

    try {
        // Query the database to check if there is any cart associated with the session ID
        const result = await query('SELECT cart_id, status FROM Carts WHERE session_id = ?', [sessionID]);
        
        // Check if an active cart exists among the retrieved carts
        // If an active cart exists, return its cart ID
        const activeCart = result.find(cart => cart.status === 'active');
        if (activeCart) {
            const activeCartID = activeCart.cart_id;
            console.log('CART ID - Active cart ID found:', activeCartID,'\n');
            return res.json({ cartID: activeCartID });
        }
        
        // No active cart found or only completed carts exist; create new cart using the stored procedure
        const [results] = await query('CALL CreateCart(?)', [sessionID]);

        // Extract the newly created cart ID 
        const newCartID = results[0]?.cart_id;
        if (newCartID) {
            console.log('CART ID - New cart ID:', newCartID,'\n');
            return res.json({ cartID: newCartID });
        } 

        // Throw an error if creating new cart fails
        throw new Error('Failed to generate a new cart ID');
        
    } catch (err) {
        // Log the error and send a 500 response
        console.error('Error creating new cart:', err.message,'\n');
        res.status(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------
// DIALOG PRODUCT IMAGE 
// Endpoint for retrieving product image from the PRODUCTS table based on a given barcode ID
app.get('/shopper/dialog/product-image', async (req, res) => {
    // Extract the barcode ID from the query parameters
    const { barcode } = req.query;
    console.log('DIALOG PRODUCT IMAGE - Received request TO FETCH PRODUCT IMAGE for this barcode:', barcode);

    // Validate if the barcode exists in the request
    if (!barcode) {
        console.error('DIALOG PRODUCT IMAGE - Barcode ID is required\n');
        return res.status(400).json({ error: 'Barcode ID is required' });
    }

    try {
        // Query the database to check if the product exists in the database
        const existingProduct = await query('SELECT 1 FROM Products WHERE barcode_id = ?', [barcode]);

        if (existingProduct.length > 0) {
            // Product exists; retrieve required product details
            const productDetails = await query('SELECT product_name, product_image, price, weight, weight_unit FROM Products WHERE barcode_id = ?',[barcode]);

            const product = productDetails[0]; // Expecting one row only

            // If product image is null, assign the string 'No image' as placeholder
            if (product.product_image == null) {
                product.product_image = 'No image';
            }

            console.log('DIALOG PRODUCT IMAGE - Product details fetched successfully for barcode:', barcode,'\nResults:', product,'\n');
            res.json(product);
        } else {
            // Product does not exist; log and send response
            console.log('DIALOG PRODUCT IMAGE - Product does not exist in database\n');
            res.status(400).json({message: 'Product does not exist in database' });
        }
    } catch (err) {
        // Log the error and send a 500 response
        console.error('Error fetching product details:', err.message,'\n');
        res.status(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------
// BARCODE SCANNER 
// Endpoint to add a product to the cart using AddExistingItemCart or AddItemCart stored procedure
// Handles product addition or quantity update in the cart through barcode scanning
app.post('/shopper/cart', async (req, res) => {
    // Extract the cartID, barcodeID, and quantity from the request body
    const { cart_id, barcode_id, quantity } = req.body;
    console.log(`BARCODE_CART - Received request TO ADD PRODUCT to cart: cart_id = ${cart_id}, barcode_id = ${barcode_id}, quantity = ${quantity}`);

    try {
        // Start a database transaction
        await rawQuery('START TRANSACTION');

        // Verify if the cart ID exists
        const cartResults = await rawQuery('SELECT * FROM Carts WHERE cart_id = ?', [cart_id]);
        if (!cartResults || cartResults.length === 0) {
            // If the cart does not exist, rollback and return an error response
            await rawQuery('ROLLBACK');
            console.log(`BARCODE_CART - Cart ID ${cart_id} not found in the database.\n`);
            return res.status(400).json({ error: 'Cart ID not found' });
        }
        
        // Check remaining stocks for the product
        // Lock the product row in the Products table to prevent race conditions
        const result = await rawQuery('SELECT quantity FROM Products WHERE barcode_id = ? FOR UPDATE', [barcode_id]);
        console.log('BARCODE_CART - Results from PRODUCT TABLE query:', result);
        if (!result || result.length === 0) {
            // If the product does not exist, rollback and return an error response
            await rawQuery('ROLLBACK');
            console.log('BARCODE_CART - Product not found.\n');
            return res.status(404).json({ error: 'Product not found' });
        }

        const availableQuantity = result[0].quantity;
        if (quantity > availableQuantity) {
            // If insufficient stock, rollback and inform the user
            await rawQuery('ROLLBACK');
            console.log('BARCODE_CART - Insufficient quantity in stock\n');
            return res.json({ message: 'Insufficient quantity in stock', quantity: availableQuantity})   
        }

        // Check if the product already exists in the cart
        const existingItemResults = await rawQuery('SELECT * FROM CartItems WHERE cart_id = ? AND barcode_id = ? FOR UPDATE', [cart_id, barcode_id]);
        if (existingItemResults.length > 0) {
            // If the item exists, update the quantity 
            await rawQuery('CALL AddExistingItemCart(?, ?, ?)', [cart_id, barcode_id, quantity]);
            console.log(`BARCODE_CART - Updated quantity for existing item: cart_id = ${cart_id}, barcode_id = ${barcode_id}, quantity = ${quantity}\n`);            
        } else {
            // If the item doesn't exist in cart, add to cart
            await rawQuery('CALL AddItemCart(?, ?, ?)', [cart_id, barcode_id, quantity]); 
            console.log('BARCODE_CART - Added successfully!\n');
        }

        // Commit the transaction after successful operations
        await rawQuery('COMMIT');
        return res.json({ message: 'Added Successfully!', quantity: availableQuantity});
    } catch (err) {
        // Rollback the transaction on any error
        await rawQuery('ROLLBACK');

        // Log the error and send a 500 response
        console.error('Error adding to cart:', err.message,'\n');
        res.status(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------
// CART ITEMS
// Endpoint to retrieve all items for a specific cart from CartItems table
app.get('/shopper/cart', async (req, res) => {
    // Extract the cart ID from the query parameters
    const { cartID } = req.query;
    console.log('CART ITEMS - Received request TO FETCH CART ITEMS for this cart:', cartID);

    // Validate to ensure cart ID is provided
    if (!cartID) {
        console.error('CART ITEMS - Cart ID is required\n');
        return res.status(400).json({ error: 'Cart ID is required '});
    }

    try {
        // Query the database to fetch the cart items for the specified cartID
        const results = await query('SELECT cart_item_id, cart_id, product_name, price, quantity, p_total, product_image FROM CartItems WHERE cart_id = ?', [cartID]);
        
        // Log result and respond with the list of cart items
        console.log('CART ITEMS - Items fetched successfully for cartID: ', cartID,'\nResults: ', results,'\n');
        res.json(results);
    } catch (err) {
        // Log the error and send a 500 response
        console.error('Error fetching cart items:', err.message,'\n');
        res.status(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------
// CART TOTAL
// Endpoint to retrieve the total amount for a cart from the Carts table
app.get('/shopper/cart/total/:cart_id', async (req, res) => {
    // Extract cart_id from the route parameters
    const { cart_id } = req.params;
    console.log('CART TOTAL - Received request TO GET TOTAL for cart ID:', cart_id);

    try {
        // Query the database to fetch the total price for the specified cart
        const result = await query('SELECT total_price FROM Carts WHERE cart_id = ?', [cart_id]);

        // Navigate through the result to retrieve the total_price
        // Default to 0 if no matching cart is found
        const total = result[0]?.total_price || 0;
        console.log('CART TOTAL - ||', cart_id, '=', total,'||\n');

        // Respond with the total price
        res.json({ total });
    } catch (err) { 
        // Log the error and send a 500 response
        console.error('Error fetching cart total:', err.message,'\n');
        res.status(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------
// CART QUANTITY 
// Endpoint to update the quantity of a specific item in the cart using UpdateCartItem stored procedure
app.put('/shopper/cart/update-quantity', async (req, res) => {
    // Extract cart_item_id and newQuantity from the query parameters
    const { cart_item_id, newQuantity } = req.query;
    console.log('CART QUANTITY - Received request TO UPDATE QUANTITY OF cart item:', cart_item_id, 'with new quantity:', newQuantity);

    // Validate newQuantity to ensure it is greater than zero
    if (newQuantity <= 0) {
        console.error('Invalid quantity: ', newQuantity,'\n');
        return res.status(400).json({ error: 'Invalid quantity' });
    }

    try {
        // Call the UpdateCartItem stored procedure to update item quantity
        const result = await query('CALL UpdateCartItem(?, ?)', [cart_item_id, newQuantity]);

        // Retrieve the status message from the stored procedure result
        // Default to null if no status message is returned
        let statusMessage = result[0][0]?.status_message || result[1][0]?.status_message;

        if (statusMessage) {
            // Log and respond with the status message if available
            console.log('CART QUANTITY - IF BLOCK Status message:', statusMessage,'\n');
            res.status(200).json({ message: statusMessage });
        } else {
            // Log and respond with an error if no status message is returned
            console.log('CART QUANTITY - ELSE BLOCK Status message:', statusMessage,'\n');
            res.sendStatus(400);
        }
    } catch (err) {
        // Log the error and send a 500 response
        console.error('Error updating cart item: ', err.message,'\n');
        res.status(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------
// CART REMOVE
// Endpoint to remove an item in the cart using DeletCartItem stored procedure
app.delete('/shopper/cart/delete-item', async (req, res) => {
    // Extract cart_item_id from the query parameters
    const { cart_item_id } = req.query;
    console.log('CART REMOVE - Received request TO REMOVE item: ', cart_item_id);

    try {
        // Call the DeleteCartItem stored procedure to remove an item
        await query('CALL DeleteCartItem(?)', [cart_item_id]);

        // Log success and send a 200 response
        console.log('CART REMOVE - Item deleted successfully: ', cart_item_id,'\n');
        res.sendStatus(200); 
    } catch {
        // Log the error and send a 500 response
        console.error('Error removing cart item: ', err.message,'\n');
        res.json(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------
// MANUAL SELECTION
// Endpoint for retrieving product details based on the category
app.get('/shopper/products/category/:category', async (req, res) => {
    // Extract the category from the request URL parameters
    const { category } = req.params;
    console.log(`MANUAL SELECTION - Received request TO GET PRODUCTS using this category: ${category}\n`);
    
    try {
        // Query the database for products matching the specified category
        const results = await query('SELECT * FROM Products WHERE category_name = ?', [category]); 

        if (results.length > 0) {
            // Map through results and include only desired fields
            const filteredResults = results.map(product => ({
                product_name: product.product_name,
                product_image: product.product_image,
                price: product.price,
                weight: product.weight,
                weight_unit: product.weight_unit,
                quantity: product.quantity,
                category: product.category
            }));
    
            // Uncomment if there's a need to check the filtered result
            //console.log(`MANUAL SELECTION - Filtered Products: ${JSON.stringify(filteredResults)}`);

            // Respond with the filtered product details
            res.json(filteredResults);
        } else {
            // Log and respond with a 404 if no products are found for the given category
            console.log('MANUAL SELECTION - No products found for this category\n');
            res.status(404).json({ error: 'No products found for this category' });
        }
    } catch (err) {
        // Log the error message and stack trace for detailed debugging
        console.error('MANUAL SELECTION - Error retrieving products with cateogry: ', category, 'Message: ', err.message,'\n');
        console.error('MANUAL SELECTION - Error Stack:', err.stack,'\n');

        // Respond with a 500 status for server errors
        res.status(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------
// MANUAL SELECTION CART
// Endpoint to add a product to the cart using ManualAddExistingItemCart or ManualAddItemCart stored procedures
app.post('/shopper/manual-selection/cart', async (req, res) => {
    // Extract cart ID, product name, and quantity from the request body
    const { cart_id, product_name, quantity } = req.body;
    console.log(`MANUAL SELECTION CART - Received request TO ADD PRODUCT to cart: cart_id = ${cart_id}, product_name = ${product_name}, quantity = ${quantity}`);

    try {
        // Start a transaction
        await rawQuery('START TRANSACTION');

        // Verify if the cart ID exists
        const cartResults = await rawQuery('SELECT * FROM Carts WHERE cart_id = ?', [cart_id]);
        if (!cartResults || cartResults.length === 0) {
            // Rollback transaction and respond if the cart ID is not found
            await rawQuery('ROLLBACK');
            console.log(`MANUAL SELECTION CART - Cart ID ${cart_id} not found in the database.\n`);
            return res.status(400).json({ error: 'Cart ID not found' });
        }

        // Lock the product row in the Products table to prevent race conditions
        const productResults = await rawQuery('SELECT quantity FROM Products WHERE product_name = ? FOR UPDATE', [product_name]);
        if (!productResults || productResults.length === 0) {
            // Rollback transaction and respond if the product is not found
            await rawQuery('ROLLBACK');
            console.log('MANUAL SELECTION CART - Product not found.\n');
            return res.status(404).json({ error: 'Product not found' });
        }

        // Get the available quantity for the product
        const availableQuantity = productResults[0].quantity;

        // Check if the requested quantity exceeds the available stock
        if (quantity > availableQuantity) {
            // Rollback transaction and respond if there is insufficient stock
            await rawQuery('ROLLBACK');
            console.log('MANUAL SELECTION CART - Insufficient quantity in stock.\n');
            return res.json({ message: 'Insufficient quantity in stock', quantity: availableQuantity });
        }

        // Check if the product already exists in the cart
        const existingItemResults = await rawQuery('SELECT * FROM CartItems WHERE cart_id = ? AND product_name = ? FOR UPDATE', [cart_id, product_name]);
        if (existingItemResults.length > 0) {
            // Update the existing item's quantity
            await rawQuery('CALL ManualAddExistingItemCart(?, ?, ?)', [cart_id, product_name, quantity]);
            console.log(`MANUAL SELECTION CART - Updated quantity for existing item: cart_id = ${cart_id}, product_name = ${product_name}, quantity = ${quantity}\n`);
        } else {
            // Add the item to the cart
            const addItemResults = await rawQuery('CALL ManualAddItemCart(?, ?, ?)', [cart_id, product_name, quantity]);
            console.log(`MANUAL SELECTION CART - Product added to cart.\n`);
        }

        // Commit the transaction
        await rawQuery('COMMIT');
        res.json({ message: 'Added Successfully!', quantity: availableQuantity });

    } catch (err) {
        // Log the error and perform a rollback in case of failure
        await rawQuery('ROLLBACK');
        console.error('Error adding to cart:', err.message,'\n');
        res.status(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------
// CHECK STOCK
// Endpoint to handle checking stock using CheckCartStock stored procedure 
app.post('/shopper/check-stock', async (req, res) => {
    // Extract the cart ID from the request query
    const { cartID } = req.query;
    console.log(`CHECK STOCK - Received request TO CHECK STOCK for this product: ${cartID}`);

    try {
        // Call the stored procedure to check item stock
        const dbResult = await query('CALL CheckCartStock(?)', [cartID]);

        // Extract the result from the stored procedure response
        const result = dbResult[0][0];

        if (result.error_message) {
            // If there is an error message, respond with it and a 200 status code
            console.log(`CHECK STOCK - Error message: `, result.error_message,'\n');
            res.status(200).json({ message: result.error_message });
        } else if (result.success_message) {
            // If there is a success message, respond with it and a 200 status code
            console.log(`CHECK STOCK - Success message: `, result.success_message,'\n');
            res.status(200).json({ message: result.success_message });
        } else {
            // Handle unexpected formats or missing messages
            res.status(500).json({ error: 'Unexpected response format from stored procedure' });
        }
    } catch (err) {
        // Log the error and respond with a 500 status code
        console.error('Error checking cart stock:', err,'\n');
        res.status(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------
const paymentQueue = [];
let isProcessingQueue = false;

async function handlePaymentRequest(req, res) {
    try {
        // Extract the user ID, cart ID, and payment method from the request body
        const { userID, cartID, paymentMethod } = req.body;
        console.log(`PAYMENT METHOD - Processing request for cartID: ${cartID}`);
        
        // Check if a transaction already exists for the given cart ID
        const existingTransactions = await query('SELECT * FROM Transactions WHERE cart_id = ?', [cartID]);
        console.log('Existing Transactions:', existingTransactions,'\n');
        
        if (existingTransactions.length > 0) {
            // If a transaction already exists, update the payment method only if it's different
            if (existingTransactions[0].payment_method !== paymentMethod) {
                const updateResults = await query('UPDATE Transactions SET payment_method = ? WHERE cart_id = ?', [paymentMethod, cartID]);
                console.log('PAYMENT METHOD - Update Results:', updateResults,'\n');

                if (updateResults.affectedRows > 0) {
                    throw new Error('Unable to update payment method');
                } 
            }

            // Retrieve the updated transaction's receipt number
            const updatedTransaction = await query('SELECT official_receiptnum FROM Transactions WHERE cart_id = ?', [cartID]);

            if (!updatedTransaction) {
                throw new Error('Failed to retrieve receipt number');
            } 

            const receiptNumber = updatedTransaction[0]?.official_receiptnum;
            console.log('PAYMENT METHOD - Receipt Number:', receiptNumber,'\n');

            // Respond with the receipt number
            return res.json({ receiptNumber });
        } 

        // If no existing transaction, call the stored procedure to create a new transaction
        const dbResults = await query('CALL CreateTransaction(?, ?, ?)', [userID, cartID, paymentMethod]);

        // Validate database response
        if (!Array.isArray(dbResults) || dbResults.length === 0 || !dbResults[0][0]?.official_receiptnum) {
            throw new Error('Unexpected result format from database');
        }

       const receiptNumber = dbResults[0][0].official_receiptnum;
       console.log('PAYMENT METHOD - New Receipt Number:', receiptNumber,'\n');
    
        // Respond with the generatedreceipt number
        res.json({ receiptNumber });
        
    } catch (err) {
        // Log the error and respond with a 500 status code
        console.error('Error processing payment method:', err.message, '\n');
        res.status(500).json({ error: err.message });
    }
}
//----------------------------------------------------------------------------------------------------------------------------------------------
async function processPaymentQueue() {
    // Prevent concurrent queue processing and ensure there are items in the queue
    if (isProcessingQueue || paymentQueue.length === 0) return;

    isProcessingQueue = true;
    try {
        while (paymentQueue.length > 0) {
            // Dequeue and process each payment request seqeuntially
            const { req, res } = paymentQueue.shift();
            await handlePaymentRequest(req, res);
        }
    } finally {
        // Reset processing flag when queue is empty
        isProcessingQueue = false;
    }
}
//----------------------------------------------------------------------------------------------------------------------------------------------
// PAYMENT METHOD
// Endpoint to update the payment method in Transactions table
app.post('/shopper/payment-method', (req, res) => {
    // Extract user ID, cart ID, and payment method from the request body
    const { userID, cartID, paymentMethod } = req.body;
    console.log(`PAYMENT METHOD - Received request TO UPDATE TRANSACTIONS TABLE using:\n userID: ${userID}\n cartID: ${cartID}\n payment method: ${paymentMethod}`);
    
    // Validate that the cart ID is provided
    if (!cartID) {
        console.error('PAYMENT METHOD - Cart ID is required\n');
        return res.status(400).json({ error: 'Cart ID is required' });
    }

    // Add the payment request to the queue for processing
    paymentQueue.push({ req, res });

    // Initiate processing of the payment queue if not already in progress 
    processPaymentQueue();
});
//----------------------------------------------------------------------------------------------------------------------------------------------
// REMOVE INSUFFICIENT QUANTITY
// Endpoint to remove items with insufficient quantity from the cart
app.post('/shopper/remove/item', async (req, res) => {
    // Retrieve the cart ID from the query parameters
    const cartID = req.query.cartID;
    console.log(`REMOVE INSUFFICIENT QUANTITY - Received request to UPDATE STATUS for cartID: ${cartID}`);

    // Validate that the cart ID is provided
    if (!cartID) {
        console.error('REMOVE INSUFFICIENT QUANTITY - Missing cartID in request\n');
        return res.sendStatus(400); // Send only status code 400 for missing cartID
    }

    try {
        // Call the stored procedure to remove items with insufficient stock
        const result = await query('CALL RemoveInsufficientStockCartItems(?)', [cartID]);

        if (result && result[0] && result[0][0]) {
            // Check for success or error in stored procedure response
            if (result[0][0].success_message) {
                console.log('REMOVE INSUFFICIENT QUANTITY - Status updated successfully\n');
                res.sendStatus(200); // Send only status code 200 on success
            } else {
                console.log('REMOVE INSUFFICIENT QUANTITY - Error in status update:', result[0][0].error_message,'\n');
                res.sendStatus(400); // Send only status code 400 if there's an error message
            }
        } else {
            console.log('REMOVE INSUFFICIENT QUANTITY - Unexpected response format from stored procedure\n');
            res.sendStatus(500); // Send only status code 500 for unexpected format
        }
    } catch (err) {
        // Log the error and respond with a 500 status code
        console.error('REMOVE INSUFFICIENT QUANTITY - Error removing item:', err,'\n');
        res.sendStatus(500); 
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------
// CHECKOUT
// Endpoint to retrieve the receipt details from TransactionItems table
app.get('/shopper/checkout', async (req, res) => {
    // Retrieve the receipt number from the query parameters
    const receipt_num = req.query.receipt_num;
    console.log(`CHECKOUT - Received request TO GET RECEIPT ITEMS for: ${receipt_num}`);

    // Validate if receipt number is provided
    if (!receipt_num) {
        console.error('CHECKOUT - Receipt number is required\n');
        return res.status(400).json({ error: 'Receipt number is required' });
    }

    try {
        // Query the database to fetch the receipt items associated with the given receipt number
        const result = await query('SELECT product_name, price, quantity, total_cost FROM TransactionItems WHERE official_receiptnum = ?', [receipt_num]);
        console.log('CHECKOUT - Receipt items fetched successfully for:', receipt_num,'\n');

        // Uncomment if there's a need to check the retrieved receipt items
        //console.log('CHECKOUT - Retrieved receipt items: ', result,'\n');

        // Return the retrieved items
        res.json(result);
    } catch (err) {
        // Log the error and respond with a 500 status code
        console.error('Error fetching receipt items:', err.message,'\n');
        res.status(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------
// CHECKOUT TOTAL
// Endpoint to retrieve the reciept total from Transactions table
app.get('/shopper/receipt/total/:receipt_num', async (req, res) => {
    // Extract the receipt number from the route parameters
    const { receipt_num } = req.params;
    console.log('CHECKOUT TOTAL - Received request TO GET TOTAL for receipt number:', receipt_num);

    try {
        // Query the database to retrieve the total cost associated with the given receipt number
        const result = await query('SELECT total_cost FROM Transactions WHERE official_receiptnum = ?', [receipt_num]);
        
        // Uncomment if there's a need to check the raw datase result
        //console.log('Raw database result:', result);

        // Check if any data was retrieved
        if (result.length > 0) {
            // Extract the cost, defaulting to 0 if undefined
            const total = result[0]?.total_cost || 0;
            console.log('CHECKOUT TOTAL - ||', receipt_num, '=', total,'||\n');
            res.json({ total });
        } else {
            // No matching receipt found, return total as 0
            console.log('CHECKOUT TOTAL - No data found for receipt number:', receipt_num,'\n');
            res.json({ total: 0 });
        }
    } catch (err) {
        // Log the error and respond with a 500 status code
        console.error('Error fetching receipt total:', err.message,'\n');
        res.status(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------
// TRANSACTION HISTORY 
// Endpoint to retrieve the transaction history from Transactions table
app.get('/shopper/transaction-history', async (req, res) => {
    // Retrieve the user ID from the query parameters
    const userID = req.query.userID;
    console.log(`TRANSACTION HISTORY - Received request TO RETRIEVE TRANSACTION ITEMS for this userID: ${userID}`);

    try {
        // Query the database to fetch transaction history details for the given user ID
        const result = await query('SELECT official_receiptnum, created_at, total_cost, payment_method FROM Transactions WHERE user_id = ?', [userID]);

        // Log the query result
        console.log('TRANSACTION HISTORY - Retrieved transactions: ', result,'\n');

        // Send result as JSON response
        res.json(result);
    } catch (err) {
        // Log the error and respond with a 500 status code
        console.error('TRANSACTION HISTORY - Error retrieving transactions:', err.message,'\n');
        res.status(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------
// END SESSION
// Endpoint to end the shopping session using EndShoppingSession stored procedure
app.post('/shopper/end-session', async (req, res) => {
    // Retrieve the session ID from the query parameters
    const sessionID = req.query.sessionID; 
    console.log(`END SESSION - Received request TO END SHOPPING SESSION for: ${sessionID}`);

    // Validate if session ID is provided
    if (!sessionID) {
        return res.status(400).json({ error: 'Session ID is required' });
    }

    try {
        // Call the stored procedure to end the shopping session
        const [result] = await query('CALL EndShoppingSession(?)', [sessionID]); // Store the result

        // Log the result (assuming result is an array)
        console.log('END SESSION -', result,'\n');

        // Respond with the result
        res.json(result);
    } catch (err) {
        // Log the error and respond with a 500 status code
        console.error('END SESSION - Error: ', err,'\n'); 
        res.status(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------

//**********VERIFIER ROUTE***************

// VERIFIER ID
// Endpoint to create verifier ID using CreateVerification stored procedure
app.post('/verifier/verification-id', async (req, res) => {
    // Retrieve receipt number and user ID from the query parameters
    const { receipt_num, userID } = req.query;
    //const userID = req.query.userID;
    console.log(`VERIFIER ID - Received request TO CREATE VERIFIER ID for this official receipt number: ${receipt_num} with ${userID}`);
  
    try {
        // Call the stored procedure to create verification ID
        const result = await query('CALL CreateVerification(?, ?)', [userID, receipt_num]);

        // Extract the newly created verification ID
        const newVerificationID = result[0][0]?.verification_id;
        console.log('VERIFIER ID - New ID: ', newVerificationID,'\n');

        // Respond with the verification ID
        res.json({ verification_id: newVerificationID });
        
    } catch (err) {
        // Log the error and respond with a 500 status code
        console.error('VERIFIER ID - Error fetching verifier id:', err.message,'\n');
        res.status(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------
// VERIFIER RECEIPT NUMBER 
// Endpoint to check if receipt number exists in the Transactions table
app.get('/verifier/receipt-number', async (req, res) => {
    // Retrieve the receipt number from the query parameters
    const receipt_num = req.query.receipt_num;
    console.log(`VERIFIER RECEIPT NUMBER - Received request TO CHECK EXISTENCE of this official receipt number: ${receipt_num}`);
  
    try {
        // Query the database to check if the given receipt number exists 
        const results = await query('SELECT official_receiptnum FROM Transactions WHERE official_receiptnum = ?', [receipt_num]);

        // Uncomment if there's a need to check raw database result
        //console.log('Result: ', results,'\n');

        if (results.length > 0) {
            // Extract and log the retrieved receipt number
            const receiptNumber = results[0]?.official_receiptnum;
            console.log(`VERIFIER RECEIPT NUMBER - Official receipt number: `, receiptNumber,'\n');

            // Respond with a message indicating a match (receipt number exists)
            res.json({ message: 'Matched' }); 
        } else {
            // Log the result and respond with null indicating no receipt number found
            console.log('No receipt number found\n');
            res.json({ message: null });
        }
    } catch (err) {
        // Log the error and respond with a 500 status code
        console.error('Error fetching receipt items:', err.message,'\n');
        res.status(500).json({ error: err.message });
    }
}); 
//----------------------------------------------------------------------------------------------------------------------------------------------
// VERIFIER RECEIPT ITEMS 
// Endpoint to retrieve receipt items from TransactionItems table
app.get('/verifier/receipt-items', async (req, res) => {
    // Retrieve the receipt number from the query parameters
    const receipt_num = req.query.receipt_num;
    console.log(`VERIFIER RECEIPT ITEMS - Received request TO GET ITEMS for: ${receipt_num}`);

    // Validate if receipt number is provided
    if (!receipt_num) {
        console.error('VERIFIER RECEIPT ITEMS - Receipt number is required\n');
        return res.status(400).json({ error: 'Receipt number is required' });
    }

    try {
        // Query the database to retrieve the receipt items from the TransactionItems table
        const result = await query('SELECT product_name, price, quantity, total_cost FROM TransactionItems WHERE official_receiptnum = ?', [receipt_num]);

        // Uncomment if there's a need to check the raw result from the database
        //console.log('VERIFIER RECEIPT ITEMS - Retrieved receipt items: ', result);

        // Log successful retrieval of receipt items
        console.log(`VERIFIER RECEIPT ITEMS - Items fetched successfully for: ${receipt_num}\n`);

        // Respond with the retrieved items
        res.json(result);
    } catch (err) {
        // Log the error and respond with a 500 status code
        console.error('Error fetching receipt items:', err.message,'\n');
        res.status(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------
// VERIFIER RECEIPT TOTAL
// Endpoint to retrieve the reciept total from Transaction table
app.get('/verifier/receipt/total/:receipt_num', async (req, res) => {
    // Extract the receipt number from the route parameters
    const { receipt_num } = req.params;
    console.log('VERIFIER RECEIPT TOTAL - Received request TO GET TOTAL for:', receipt_num);

    try {
        // Query the database to retrieve the total cost associated with the given receipt number
        const result = await query('SELECT total_cost FROM Transactions WHERE official_receiptnum = ?', [receipt_num]);
        
        // Uncomment if there's a need to check the raw database result
        //console.log('Raw result:', result);

        if (result.length > 0) {
            // Extract the total cost and log the receipt total
            const total = result[0]?.total_cost || 0;
            console.log('VERIFIER RECEIPT TOTAL - ||', receipt_num, '=', total,'||\n');

            // Return the total
            res.json({ total });
        } else {
            // Log and return 0 to indicate no data found for the receipt number
            console.log('VERIFIER RECEIPT TOTAL - No data found for receipt number:', receipt_num,'\n');
            res.json({ total: 0 });
        }
    } catch (err) {
        // Log the error and respond with a 500 status code
        console.error('VERIFIER RECEIPT TOTAL - Error fetching receipt total:', err.message,'\n');
        res.status(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------
// UPDATE VERIFICATION STATUS
// Endpoint to update the verification status using the UpdateVerStatus
app.post('/verifier/verification/status', async (req,res) => {
    // Retrieve the verification ID from the query parameters
    const verification_id = req.query.verification_id;
    console.log(`VERIFICATION STATUS - Received request TO UPDATE STATUS for: ${verification_id}`);

    try {
        // Call the stored procedure to update the verification status
        const result = await query('CALL UpdateVerStatus(?)', [verification_id]);

        // Uncomment if there's a need to check the raw result
        //console.log('Result: ', result);

        // Log the affected rows and send the result
        console.log('Result: ', result.affectedRows,'\n');
        res.json(result);
    } catch (err) {
        // Log the error and respond with a 500 status code
        console.log(`VERIFICATION STATUS - `, err.message,'\n');
        res.status(500).json({ error: err.message });
    }
});
//----------------------------------------------------------------------------------------------------------------------------------------------

// Set up the server
const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

server.setTimeout(1000000); // Set timeout to 10 seconds (10000 milliseconds)


