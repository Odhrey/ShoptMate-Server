const express = require('express');
//const mysql = require('mysql2/promise');
const path = require('path');
const bodyParser = require('body-parser');
const { query, rawQuery, pool } = require('./db'); 

const { v4: uuidv4 } = require('uuid');
const JsBarcode = require('jsbarcode');
const { createCanvas } = require('canvas');
const moment = require('moment');
 
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
// Ping server to determine if server is reachable or unreachable
app.get('/ping', (req, res) => {
    res.status(200).send('Pong');
});

//**********AUTHENTICATION ROUTES************

// REGISTRATION
// Add new user to Users table in database
app.post('/registration/user/name/password/role', async (req, res) => {
    const { userName, userPassword, userRole } = req.body;
    console.log(` REGISTRATION - Received request TO ADD TO USER TABLE:\n userName: ${userName} \n userPassword: ${userPassword} \n userRole: ${userRole}`);

    try {
        // Check if the username already exists
        const existingUsername = await query('SELECT username FROM Users WHERE username = ?', [userName]);

        const username = existingUsername[0]?.username;
        if (username && username.toLowerCase() === userName.toLowerCase()) {
            console.log('REGISTRATION - Username already exists');
            res.json({ message: 'Username already exists' });
        } else {
            // Add new user and return their user_id
            const result = await query('CALL AddUser(?, ?, ?)', [userName, userPassword, userRole]);
            const newUserID = result[0][0]?.user_id;
            console.log('New User ID: ', newUserID);

            if (newUserID) {
                // Return the newly created user_id
                res.json({ message: 'User registered successfully' });
            } else {
                // Handle case where user creation fails
                res.status(400).json({ message: 'Failed to add user' });
            }  
        }
        
    } catch (err) {
        console.error(`Error adding user: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// LOG IN
// Check if user exists based oin username in the Users table
app.post('/login/user/name/role', async (req, res) => {
    const { userName, userRole } = req.body;
    console.log(`LOG IN - Received request TO CHECK USER TABLE:\n username: ${userName} \n userRole: ${userRole}`);

    try {
        // Check if the user already exists, filter by username and role
        const result = await query('SELECT user_id, password_hash FROM Users WHERE username = ? AND role_name = ?', [userName, userRole]);

        if (result.length > 0) {
            const existingUser = result[0];  // Get the first user
            console.log('Existing password and User ID: ', existingUser);
            res.json({ 
                user_id: existingUser.user_id, 
                password_hash: existingUser.password_hash 
            });
        } else {
            console.log('User not found: ', result);
            return res.sendStatus(404);
        }
    } catch (err) {
        console.error(`LOG IN - Error checking user: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// CHANGE PASSWORD
// Change user password based on username in the Users table
app.post('/login/user/change/password', async (req, res) => {
    const { userName, userPassword } = req.body;
    console.log(`CHANGE PASSWORD - Received request TO CHECK USER TABLE:\n username: ${userName}, password: ${userPassword}`);

    try {
        // Check if the user already exists, filter by username and role
        const result = await query('SELECT user_id FROM Users WHERE username = ?', [userName]);

        if (result.length > 0) {
            const existingUserID = result[0]?.user_id;  
            const results = await query('CALL CreatePasswordReset(?, ?)', [existingUserID, userPassword]);
            console.log('CHANGE PASSWORD - Existing User ID: ', results);
            res.json({ message: 'Password changed successfully' });
        } else {
            console.log('User not found: ', result);
            res.status(404).json({ message: 'User does not exist' });
        }
    } catch (err) {
        console.error(`CHANGE PASSWORD - Error checking user: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// DASHBOARD CARD USER ID 
app.post('/dashboard/user-card/userID', async (req, res) => {
    const { userName, userRole } = req.body;
    console.log(`DASHBOARD CARD USER ID - Received request TO RETRIEVE USER ID for this user: ${userName}, userRole: ${userRole}`);

    try {
        // Retrieve user ID for the user
        const result = await query('SELECT user_id FROM Users WHERE username = ? AND role_name = ?', [userName, userRole]);

        if (result.length > 0) {
            const userID = result[0]?.user_id;  // Get the first user
            console.log('Retrieved user ID:', userID);
            res.json({ user_id: userID});
        } else {
            res.status(404).json({ message: "User ID not found" });
        }
    } catch (err) {
        console.error(`Error checking user: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

//**********ADMIN ROUTES************

// LATEST CATEGORIES
//Retrieve latest categories from categories table
app.get('/admin/latest/categories', async (req, res) => {
    try {
        const result = await query('SELECT category_name FROM Categories')
      
        if (result.length > 0) {
            console.log('Result: ', result);
            res.json({ result })
        } 
        
    } catch (err) {
        console.error('Error retrieving categories:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// NEW CATEGORY
//Adds new category to the categroy table
app.post('/admin/categories', async (req, res) => {
    const category = req.query.category;
    console.log('NEW CATEGORY - Request received: ', req.query);

    try {
        const existingCategory = await query('SELECT category_name FROM Categories WHERE category_name = ?', [category])
      
        if (existingCategory.length > 0) {
            console.log('Category exists:', existingCategory);
            res.json({ message: "Category already exists"})
        } else {
            const result = await query('CALL AddCategory(?)', [category]);
            console.log("NEW CATEGORY - category name: ", result);
            res.json({ message: "New category added" });
        }
        
    } catch (err) {
        console.error('Error adding category:', err.message);
        res.status(500).json({ error: err.message });
    }
});

//Initialize addProduct procedure in the server
async function addProduct(barcodeNumber, barcodeImage, productName, categoryName, price, weight, weightUnit, Quantity) {
    const queryStr = 'CALL AddProduct(?, ?, ?, ?, ?, ?, ?, ?)';
    try {

        console.log('Executing Query:', queryStr, [barcodeNumber, productName, categoryName, price, weight, weightUnit, Quantity]);
        const results = await query(queryStr, [barcodeNumber, barcodeImage, productName, categoryName, price, weight, weightUnit, Quantity]);
        return { barcodeImage: barcodeImage, name: productName, category: categoryName, price: price, weight: weight, quantity: Quantity, weight_unit: weightUnit};
    } catch (err) {
        console.error('Error executing query:', err.message);
        console.error('Full error details:', err);
        throw err;
    }
}

// NEW PRODUCT
//Adds new product to products table based on admin input
app.post('/admin/products', async (req, res) => {
    const { name, weight, price, category, weight_unit, barcode_id, quantity } = req.body;
    console.log('NEW PRODUCT - Received Data:', req.body);

    try {
      // Generate barcode image
      const barcodeImage = generateBarcode(barcode_id);
  
      // Call the addProduct function
      const result = await addProduct(barcode_id, barcodeImage, name, category, price, weight, weight_unit, quantity);
      console.log("NEW PRODUCT - Result:", result);
      res.json(result);
    } catch (err) {
      console.error('Error in API endpoint:', err.message);
      console.error('Full error details:', err);
      res.status(500).json({ error: err.message });
    }
});

// SALES REPORT
//Generate sales report for one date
app.post('/admin/sales-report/one-date', async (req, res) => {
    const userID = req.query.userID;
    const startDate = req.query.startDate;
    console.log(`SALES REPORT - Received request TO GENERATE REPORT for this dates: ${startDate} with userID: ${userID}`);

    if (!startDate) {
        console.error('SALES REPORT - Start/end date is required');
        return res.status(400).json({ error: 'Start/end date is required' });
    }

    try {
        const result = await query('CALL GetSalesDataByDate(?, ?)', [userID, startDate]);
        //check if this will work since id is in 2nd column
        console.log('Raw', result);
        const reportID = result[0][0]?.report_id; 
        console.log(`SALES REPORT - Sending report_id: ${reportID}`);
        res.json({ reportID });
    } catch (err) {
        console.error('Error fetching receipt items:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// SALES REPORT 2
//Generate sales report for two dates
app.post('/admin/sales-report/two-dates', async (req, res) => {
    const userID = req.query.userID;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    console.log(`SALES REPORT 2 - Received request TO GENERATE REPORT for these dates: ${startDate}  -  ${endDate} with userID: ${userID}`);

    if (!startDate || !endDate) {
        console.error('SALES REPORT - Start/end date is required');
        return res.status(400).json({ error: 'Start/end date is required' });
    }

    try {
        const result = await query('CALL GetSalesData(?, ?, ?)', [userID, startDate, endDate]);
        //check if this will work since id is in 2nd column
        console.log('Raw', result);
        const reportID = result[0][0]?.report_id;
        console.log(`SALES REPORT 2 - Sending report_id: ${reportID}`);
        res.json({ reportID });
    } catch (err) {
        console.error('Error fetching receipt items:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// SALES REPORT ITEMS
//Retrieves report details from sales reports table (single input)
app.get('/admin/sales-report/one-date/items', async (req, res) => {
    const reportID = req.query.reportID;
    console.log(` SALES REPORT ITEMS - Received request TO GET REPORT ITEMS for this report ID: `, reportID);

    if (!reportID) {
        console.error(' SALES REPORT ITEMS - ReportID is required');
        return res.status(400).json({ error: 'ReportID is required' });
    }

    try {
        const result = await query('SELECT product_name, quantity_sold, price_unit, total_sales FROM SalesReportItems WHERE report_id = ?', [reportID]);
        console.log(` SALES REPORT ITEMS - Receipt items fetched successfully for receipt number: ${reportID}`);
        console.log(' SALES REPORT ITEMS - Retrieved receipt items: ', result);
        res.json(result);
    } catch (err) {
        console.error('Error fetching receipt items:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// SALES REPORT ITEMS 2
//Retrieves report details from group report table (two inputs)
app.get('/admin/sales-report/two-dates/items', async (req, res) => {
    const reportID = req.query.reportID;
    console.log(` SALES REPORT ITEMS 2 - Received request TO GET REPORT ITEMS for this report ID: ${reportID}`);

    if (!reportID) {
        console.error(' SALES REPORT ITEMS 2 - ReportID is required');
        return res.status(400).json({ error: 'ReportID is required' });
    }

    try {
        const result = await query('SELECT product_name, quantity_sold, price_unit, total_sales FROM ReportProducts WHERE report_id = ?', [reportID]);
        console.log(` SALES REPORT ITEMS 2 - Receipt items fetched successfully for receipt number: ${reportID}`);
        console.log(' SALES REPORT ITEMS 2 - Retrieved receipt items: ', result);
        res.json(result);
    } catch (err) {
        console.error('Error fetching receipt items:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// REPORT HISTORY
//Retrieves sales report history
app.get('/admin/report-history', async(req, res) => {
    const userID = req.query.userID;
    console.log(`REPORT HISTORY - Received request TO RETRIEVE REPORT HISTORY ITEMS for this userID: ${userID}`);

    try {
        const result = await query('SELECT report_id, accessed_at FROM UserReportAccess WHERE user_id = ?', [userID]);
        console.log('Result: ', result);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// USER RECORD
//Retrieves user record from user table
app.get('/admin/user-record', async(req, res) => {
    try {
        const result = await query('SELECT user_id, username, role_name FROM Users');
        console.log('Result: ', result);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// REMOVE USER
//Delete a user from user table
app.post('/admin/remove-user', async (req, res) => {
    const userID = req.query.userID;
    console.log('REMOVE USER - Received request TO DELETE user: ', userID);

    try {
        const result = await query('CALL DeleteUser(?)', [userID]);
        console.log('REMOVE USER - user deleted successfully: ', result);
        res.json({ message: 'User removed' });
    } catch {
        console.error("Error removing user: ", err.message);
        res.json(500).json({ error: err.message });
    }
});

// VIEW PRODUCT
//For retrieving product details based on the category
app.get('/admin/latest/product', async (req, res) => {
    const category = req.query.category;
    console.log(`VIEW PRODUCT - Received request TO GET PRODUCTS using this category: ${category}`);
    
    try {
        const results = await query('SELECT * FROM Products WHERE category_name = ?', [category]); 
        // Check what the contents are for the result in the query and filter if needed
        console.log(`VIEW PRODUCT - Query Results: Success`);

        if (results.length > 0) {
            // Map through results and include only desired fields
            const filteredResults = results.map(product => ({
                product_name: product.product_name,
                price: product.price,
                weight: product.weight,
                weight_unit: product.weight_unit,
                quantity: product.quantity,
            }));
    
            console.log(`VIEW PRODUCT - Filtered Products: ${JSON.stringify(filteredResults)}`);
            res.json(filteredResults);
        } else {
            console.log('VIEW PRODUCT - No products found for this category');
            res.json([]);
        }
    } catch (err) {
        console.error('Error retrieving products with cateogry: ', category, 'Message: ', err.message);
        // Log the error stack for more detail
        console.error('Error Stack:', err.stack);
        res.status(500).json({ error: err.message });
    }
});

//***************SHOPPER ROUTES**************

//SHOPPING SESSION ID
//Create a new shopping session
//Edit when there's log in feature already
app.post('/shopper/create-session', async (req, res) => {
    const userID  = req.query.userID;
    console.log('SHOPPING SESSION - Received request TO CREATE SESSION for this userID: ', userID);

    try {
        const [results] = await query('CALL CreateShoppingSession(?)', [userID]);
        console.log('SHOPPING SESSION - Results from CreateShoppingSession: ', results);
        const newSessionID = results[0]?.session_id;
        console.log('New session ID: ', newSessionID);
        console.log('Sending session ID:', newSessionID);
        res.json({ session_id: newSessionID });
    } catch (err) {
        console.error('Error creating session:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// CART ID
//Create cart request to the database
//Create a new cart if there's no cart yet
app.post('/shopper/create-cart', async (req, res) => {
    const sessionID  = req.query.sessionID; 
    console.log('CART - Received request TO CREATE CART for this sessionID: ', sessionID);

    try {
        // Call the stored procedure
        const [results] = await query('CALL CreateCart(?)', [sessionID]);
        console.log('CART - Results from CreateCart:', results);
        // Retrieve the generated cart_id from the results
        const newCartId = results[0]?.cart_id; 
        console.log(`New cart created with ID: `, newCartId);
        console.log('Sending cart ID:', newCartId);
        res.json({ cartID: newCartId });
    } catch (err) {
        console.error('Error creating new cart:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// DIALOG PRODUCT IMAGE 
//Get product image from PRODUCTS TABLE
app.get('/shopper/dialog/product-image', async (req, res) => {
    const barcode = req.query.barcode;
     console.log('DIALOG PRODUCT IMAGE - Received request TO FETCH PRODUCT IMAGE for this barcode:', barcode);

    if (!barcode) {
        console.error('DIALOG PRODUCT IMAGE - Barcode ID is required');
        return res.status(400).json({ error: 'Barcode ID is required '});
      }

    try {
        const existingProduct = await query('SELECT * FROM Products WHERE barcode_id = ?', [barcode]);
        if (existingProduct.length > 0) {
            const results = await query('SELECT product_image FROM Products WHERE barcode_id = ?', [barcode]);
            const product_image = results[0]?.product_image;
            console.log('DIALOG PRODUCT IMAGE - Product image fetched successfully for barcode: ', barcode, 'Results: ', product_image);
            
            if (product_image == null) {
                console.log('Sending product image: ', product_image);
                res.json({ product_image: 'No image' });
            } else {
                console.log('Sending product image: ', product_image);
                res.json({ product_image });
            }

        } else {
            console.log('DIALOG PRODUCT IMAGE - Product does not exist in database');
            console.log('Sending product image: ', existingProduct);
            res.json({  product_image: "" });
        }
    
    } catch (err) {
        console.error('Error fetching cart items:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// BARCODE SCANNER 
//Add product to cart using the barcode and product quantity
app.post('/shopper/cart', async (req, res) => {
    const { cart_id, barcode_id, quantity } = req.body;
    console.log(`BARCODE_CART - Received request TO ADD PRODUCT to cart: cart_id=${cart_id}, barcode_id=${barcode_id}, quantity=${quantity}`);

    try {
         // Start a transaction
         await rawQuery('START TRANSACTION');

        // Verify if the cart ID exists
        const cartResults = await rawQuery('SELECT * FROM Carts WHERE cart_id = ?', [cart_id]);
        if (!cartResults || cartResults.length === 0) {
            await rawQuery('ROLLBACK');
            console.log(`Cart ID ${cart_id} not found in the database.`);
            return res.status(400).json({ error: 'Cart ID not found' });
        }
        
         // Check remaining stocks for the product
         // Lock the product row in the Products table to prevent race conditions
         const result = await rawQuery('SELECT quantity FROM Products WHERE barcode_id = ? FOR UPDATE', [barcode_id]);
         console.log('BARCODE_CART - Results from PRODUCT TABLE query:', result);
         if (!result || result.length === 0) {
             await rawQuery('ROLLBACK');
             console.log('BARCODE_CART - Product not found.');
             return res.status(404).json({ error: 'Product not found' });
         }

         const availableQuantity = result[0].quantity;
         
         if (quantity > availableQuantity) {
             await rawQuery('ROLLBACK');
             console.log('BARCODE_CART - Insufficient quantity in stock');
             return res.json({ message: 'Insufficient quantity in stock', quantity: availableQuantity})   
         }

        // Check if the product already exists in the cart
        const existingItemResults = await rawQuery('SELECT * FROM CartItems WHERE cart_id = ? AND barcode_id = ? FOR UPDATE', [cart_id, barcode_id]);
        console.log('BARCODE_CART - Results from EXISTING ITEM query:', existingItemResults);
        if (existingItemResults.length > 0) {
            // If the item exists, update the quantity after checking remaining stocks for product
            await rawQuery('CALL AddExistingItemCart(?, ?, ?)', [cart_id, barcode_id, quantity]);
            console.log(`BARCODE_CART - Updated quantity for existing item: cart_id=${cart_id}, barcode_id=${barcode_id}, quantity=${quantity}`);            
        } else {
            // If the item doesn't exist in cart, add to cart
            await rawQuery('CALL AddItemCart(?, ?, ?)', [cart_id, barcode_id, quantity]); 
            console.log('BARCODE_CART - Added successfully!');
        }

        await rawQuery('COMMIT');
        return res.json({ message: 'Added Successfully!', quantity: availableQuantity});
    } catch (err) {
        console.error('Error adding to cart:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// CART ITEMS
//Get cart items from CART ITEMS TABLE
app.get('/shopper/cart', async (req, res) => {
    const cartID = req.query.cartID;
    console.log('CART ITEMS - with Cart ID:', cartID);

        if (!cartID) {
            console.error('CART ITEMS - Cart ID is required');
            return res.status(400).json({ error: 'Cart ID is required '});
        }

        console.log('CART ITEMS - Received request TO FETCH CART ITEMS for cartId:', cartID);

    try {
        const results = await query('SELECT cart_item_id, cart_id, product_name, price, quantity, p_total, product_image FROM CartItems WHERE cart_id = ?', [cartID]);
        console.log('CART ITEMS - items fetched successfully for cartId: ', cartID, 'Results: ', results);
        res.json(results);
    } catch (err) {
        console.error('Error fetching cart items:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// CART TOTAL
//Get total for cart from CARTS TABLE
app.get('/shopper/cart/total/:cart_id', async (req, res) => {
    const { cart_id } = req.params;
    console.log('CART TOTAL - Received request TO GET TOTAL for cart ID:', cart_id);

    try {
        const result = await query('SELECT total_price FROM Carts WHERE cart_id = ?', [cart_id]);
        // Navigate through the nested structure to access the total_price
        const total = result[0]?.total_price || 0;
        console.log('CART TOTAL - Total amount for cart ID:', cart_id, 'is:', total);
        res.json({ total });
    } catch (err) {
        console.error('Error fetching cart total:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// CART QUANTITY 
//Update cart item quantity
app.put('/shopper/cart/update-quantity', async (req, res) => {
    const { cart_item_id, newQuantity } = req.query;
    console.log('CART QUANTITY  - Received request TO UPDATE cart item: ', cart_item_id, 'with new quantity: ', newQuantity);

    if (newQuantity <= 0) {
        console.error('Invalid quantity: ', newQuantity);
        return res.status(400).json({ error: 'Invalid quantity' });
    }

    try {
        const result = await query('CALL UpdateCartItem(?, ?)', [cart_item_id, newQuantity]);

        // Retrieve the status message from the result
        let statusMessage = result[0][0]?.status_message || result[1][0]?.status_message;

        if (statusMessage) {
            console.log('CART QUANTITY - IF BLOCK Status message:', statusMessage);
            res.status(200).json({ message: statusMessage });
        } else {
            console.log('CART QUANTITY - ELSE BLOCK Status message:', statusMessage);
            res.sendStatus(400);
        }
        
    } catch (err) {
        console.error('Error updating cart item: ', err.message);
        res.status(500).json({ error: err.message });
    }
});

// CART REMOVE
//Endpoint to delete an item in the cart
app.delete('/shopper/cart/delete-item', async (req, res) => {
    const { cart_item_id, newQuantity} = req.query;
    console.log('CART REMOVE - Received request TO DELETE cart item: ', cart_item_id);

    try {
        await query('CALL DeleteCartItem(?)', [cart_item_id]);
        console.log('CART REMOVE - Cart item deleted successfully: ', cart_item_id);
        res.sendStatus(200); 
    } catch {
        console.error("Error deleting cart item: ", err.message);
        res.json(500).json({ error: err.message });
    }
});

// MANUAL SELECTION
//For retrieving product details based on the category
app.get('/shopper/products/category/:category', async (req, res) => {
    const { category } = req.params;
    console.log(`MANUAL SELECTION - Received request TO GET PRODUCTS using this category: ${category}`);
    // Check what the contents are for the request parameters
    console.log(`MANUAL SELECTION - Request Parameters: ${JSON.stringify(req.params)}`);
    
    try {
        const results = await query('SELECT * FROM Products WHERE category_name = ?', [category]); 
        // Check what the contents are for the result in the query and filter if needed
        console.log(`MANUAL SELECTION - Query Results: Success }`);

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
    
           // console.log(`MANUAL SELECTION - Filtered Products: ${JSON.stringify(filteredResults)}`);
            res.json(filteredResults);
        } else {
            console.log('MANUAL SELECTION - No products found for this category');
            res.status(404).json({ error: 'No products found for this category' });
        }
    } catch (err) {
        console.error('Error retrieving products with cateogry: ', category, 'Message: ', err.message);
        // Log the error stack for more detail
        console.error('Error Stack:', err.stack);
        res.status(500).json({ error: err.message });
    }
});

// MANUAL SELECTION CART
// Add product to cart through manual product selection using product name and quantity
app.post('/shopper/manual-selection/cart', async (req, res) => {
    const { cart_id, product_name, quantity } = req.body;
    console.log(`MANUAL SELECTION CART - Received request TO ADD PRODUCT to cart: cart_id=${cart_id}, product_name=${product_name}, quantity=${quantity}`);

    try {
        // Start a transaction
        await rawQuery('START TRANSACTION');

        // Verify if the cart ID exists
        const cartResults = await rawQuery('SELECT * FROM Carts WHERE cart_id = ?', [cart_id]);
        if (!cartResults || cartResults.length === 0) {
            await rawQuery('ROLLBACK');
            console.log(`MANUAL SELECTION CART - Cart ID ${cart_id} not found in the database.`);
            return res.status(400).json({ error: 'Cart ID not found' });
        }

        // Lock the product row in the Products table to prevent race conditions
        const productResults = await rawQuery('SELECT quantity FROM Products WHERE product_name = ? FOR UPDATE', [product_name]);
        if (!productResults || productResults.length === 0) {
            await rawQuery('ROLLBACK');
            console.log('MANUAL SELECTION CART - Product not found.');
            return res.status(404).json({ error: 'Product not found' });
        }

        const availableQuantity = productResults[0].quantity;

        if (quantity > availableQuantity) {
            await rawQuery('ROLLBACK');
            console.log('MANUAL SELECTION CART - Insufficient quantity in stock');
            return res.json({ message: 'Insufficient quantity in stock', quantity: availableQuantity });
        }

        // Check if the product already exists in the cart
        const existingItemResults = await rawQuery('SELECT * FROM CartItems WHERE cart_id = ? AND product_name = ? FOR UPDATE', [cart_id, product_name]);
        if (existingItemResults.length > 0) {
            // Update the existing item's quantity
            await rawQuery('CALL ManualAddExistingItemCart(?, ?, ?)', [cart_id, product_name, quantity]);
            console.log(`MANUAL SELECTION CART - Updated quantity for existing item: cart_id=${cart_id}, product_name=${product_name}, quantity=${quantity}`);
        } else {
            // Add the item to the cart
            const addItemResults = await rawQuery('CALL ManualAddItemCart(?, ?, ?)', [cart_id, product_name, quantity]);
            console.log(`MANUAL SELECTION CART - Product added to cart: ${JSON.stringify(addItemResults)}`);
        }

        // Commit the transaction
        await rawQuery('COMMIT');
        res.json({ message: 'Added Successfully!', quantity: availableQuantity });

    } catch (err) {
        console.error('Error adding to cart:', err.message);
        await rawQuery('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// CHECK STOCK
app.post('/shopper/check-stock', async (req, res) => {
    const cartID = req.query.cartID;

    console.log(`CHECK STOCK - Received request to check stock for cartID: ${cartID}`);

    try {
        // Call the stored procedure with the cartID parameter
        const dbResult = await query('CALL CheckCartStock(?)', [cartID]);

        // Check if we received a result, which should be a single row with either `error_message` or `success_message`
        const result = dbResult[0][0];

        if (result.error_message) {
            // If there is an `error_message`, return it with a 400 status code indicating a client error
            res.status(200).json({ message: result.error_message });
            console.log(`CHECK STOCK - Error message: `, result.error_message);
        } else if (result.success_message) {
            // If there is a `success_message`, send it with a 200 status code
            res.status(200).json({ message: result.success_message });
            console.log(`CHECK STOCK - Success message: `, result.success_message);
        } else {
            // In case of an unexpected format, handle the error
            res.status(500).json({ error: 'Unexpected response format from stored procedure' });
        }
    } catch (err) {
        console.error('Error checking cart stock:', err);
        res.status(500).json({ error: err.message });
    }
});




// PAYMENT METHOD
//Update payment method in transactions table
app.post('/shopper/payment-method', async (req, res) => {
    const { userID, cartID, paymentMethod } = req.body;
    console.log(`PAYMENT METHOD - Received request TO UPDATE TRANSACTIONS TABLE using:\n userID: ${userID}\n cartID: ${cartID}\n payment method: ${paymentMethod}`);
    
    if (!cartID) {
        console.error('PAYMENT METHOD - Cart ID is required');
        return res.status(400).json({ error: 'Cart ID is required' });
    }

    try {
        // Check if a transaction already exists for the given cart ID
        const existingTransactions = await query('SELECT * FROM Transactions WHERE cart_id = ?', [cartID]);
        console.log('Existing Transactions:', existingTransactions);
        
        if (existingTransactions.length > 0) {
            // Update the payment method for the existing transaction
            const updateResults = await query('UPDATE Transactions SET payment_method = ? WHERE cart_id = ?', [paymentMethod, cartID]);
            console.log('PAYMENT METHOD - Update Results:', updateResults);
            
            if (updateResults.affectedRows > 0) {
                // Retrieve the updated transaction to get the receipt number
                const updatedTransaction = await query('SELECT official_receiptnum FROM Transactions WHERE cart_id = ?', [cartID]);
                console.log('PAYMENT METHOD - Updated Transaction:', updatedTransaction);
                const receiptNumber = updatedTransaction[0]?.official_receiptnum;
                console.log('PAYMENT METHOD - Receipt Number:', receiptNumber);
                return res.json({ receiptNumber });
            } else {
                console.log('Unable to update payment method');
                return res.status(404).json({ error: 'Unable to update payment method' });
            }
        } else {
            // Call the stored procedure to create a new transaction
            const dbResults = await query('CALL CreateTransaction(?, ?, ?)', [userID, cartID, paymentMethod]);

            if (!Array.isArray(dbResults) || dbResults.length === 0) {
                throw new Error('Unexpected result format from database');
            }
        
            const results = dbResults[0];
            const receiptNumber = results[0]?.official_receiptnum;
        
            if (!receiptNumber) {
                throw new Error('Receipt number not generated');
            }
        
            return res.json({ receiptNumber });
        }
    } catch (err) {
        console.error('Error processing payment method:', err.message);
        console.error('Error Stack:', err.stack);
        return res.status(500).json({ error: err.message });
    }
});


// REMOVE INSUFFICIENT QUANTITY
app.post('/shopper/remove/item', async (req, res) => {
    const cartID = req.query.cartID;

    if (!cartID) {
        console.error("REMOVE INSUFFICIENT QUANTITY - Missing cartID in request");
        return res.sendStatus(400); // Send only status code 400 for missing cartID
    }

    console.log(`REMOVE INSUFFICIENT QUANTITY - Received request to update status for cartID: ${cartID}`);

    try {
        // Call the stored procedure with the cartID parameter
        const result = await query('CALL RemoveInsufficientStockCartItems(?)', [cartID]);

        if (result && result[0] && result[0][0]) {
            // Check for success or error in stored procedure response
            if (result[0][0].success_message) {
                console.log("REMOVE INSUFFICIENT QUANTITY - Status updated successfully");
                res.sendStatus(200); // Send only status code 200 on success
            } else {
                console.log("REMOVE INSUFFICIENT QUANTITY - Error in status update:", result[0][0].error_message);
                res.sendStatus(400); // Send only status code 400 if there's an error message
            }
        } else {
            console.log("REMOVE INSUFFICIENT QUANTITY - Unexpected response format from stored procedure");
            res.sendStatus(500); // Send only status code 500 for unexpected format
        }
    } catch (err) {
        console.error("Error removing item:", err);
        res.sendStatus(500); // Send only status code 500 for server error
    }
});


// UPDATE STATUS
app.post('/shopper/update/status', async (req, res) => {
    const cartID = req.query.cartID;

    if (!cartID) {
        console.error("UPDATE STATUS - Missing cartID in request");
        return res.sendStatus(400); // Send only status code 400 for missing cartID
    }

    console.log(`UPDATE STATUS - Received request to update status for cartID: ${cartID}`);

    try {
        // Call the stored procedure with the cartID parameter
        const result = await query('CALL UpdateStatus(?)', [cartID]);

        if (result && result[0] && result[0][0]) {
            // Check for success or error in stored procedure response
            if (result[0][0].success_message) {
                console.log("UPDATE STATUS - Status updated successfully");
                res.sendStatus(200); // Send only status code 200 on success
            } else {
                console.log("UPDATE STATUS - Error in status update:", result[0][0].error_message);
                res.sendStatus(400); // Send only status code 400 if there's an error message
            }
        } else {
            console.log("UPDATE STATUS - Unexpected response format from stored procedure");
            res.sendStatus(500); // Send only status code 500 for unexpected format
        }
    } catch (err) {
        console.error("Error updating status:", err);
        res.sendStatus(500); // Send only status code 500 for server error
    }
});


// CHECKOUT
//Retrieves receipt details from transaction and transaction items table
app.get('/shopper/checkout', async (req, res) => {
    const receipt_num = req.query.receipt_num;
    console.log(`CHECKOUT - Received request TO GET ITEMS for this official receipt number: ${receipt_num}`);

    if (!receipt_num) {
        console.error('CHECKOUT - Receipt number is required');
        return res.status(400).json({ error: 'Receipt number is required' });
    }

    try {
        const result = await query('SELECT product_name, price, quantity, total_cost FROM TransactionItems WHERE official_receiptnum = ?', [receipt_num]);
        console.log(`CHECKOUT - Receipt items fetched successfully for receipt number: ${receipt_num}`);
        console.log('CHECKOUT - Retrieved receipt items: ', result);
        res.json(result);
    } catch (err) {
        console.error('Error fetching receipt items:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// CHECKOUT TOTAL
//Retrieves total of receipt from transaction table
app.get('/shopper/receipt/total/:receipt_num', async (req, res) => {
    const { receipt_num } = req.params;
    console.log('CHECKOUT TOTAL - Received request TO GET TOTAL for receipt number: ', receipt_num);

    try {
        const result = await query('SELECT total_cost FROM Transactions WHERE official_receiptnum = ?', [receipt_num]);
        
        // Log the raw result to understand its structure
        console.log('Raw result:', result);

        // Check the result structure
        if (result.length > 0) {
            const total = result[0]?.total_cost || 0;
            console.log('CHECKOUT TOTAL - Total amount for receipt number:', receipt_num, 'is:', total);
            res.json({ total });
        } else {
            console.log('CHECKOUT TOTAL - No data found for receipt number:', receipt_num);
            res.json({ total: 0 });
        }
    } catch (err) {
        console.error('Error fetching receipt total:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// TRANSACTION HISTORY 
//GET /shopper/transaction-history -> retrieves transaction history
app.get('/shopper/transaction-history', async (req, res) => {
    const userID = req.query.userID;
    console.log(`TRANSACTION HISTORY - Received request TO RETRIEVE TRANSACTION ITEMS for this userID: ${userID}`);

    try {
        const result = await query('SELECT official_receiptnum, created_at, total_cost, payment_method FROM Transactions WHERE user_id = ?', [userID]);
        console.log('Result: ', result);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// END SESSION
app.post('/shopper/end-session', async (req, res) => {
    const sessionID = req.query.sessionID; 
    console.log(`END SESSION - Received request TO END SESSION for this sessionID: ${sessionID}`);

    // Validate input
    if (!sessionID) {
        return res.status(400).json({ error: 'Session ID is required' });
    }

    try {
        const [result] = await query('CALL EndShoppingSession(?)', [sessionID]); // Store the result

        // Log the result (assuming result is an array)
        console.log('END SESSION - Procedure result: ', result);

        // Send back the result
        res.json(result);
    } catch (err) {
        console.error('END SESSION - Error: ', err); // Log the error for debugging
        res.status(500).json({ error: err.message });
    }
});

//**********VERIFIER ROUTE***************

// VERIFIER ID
//Create verifier ID for verifier
app.post('/verifier/verification-id', async (req, res) => {
    const receipt_num = req.query.receipt_num;
    const userID = req.query.userID;
    console.log(`VERIFIER ID - Received request TO CREATE VERIFIER ID for this official receipt number: ${receipt_num} with ${userID} `);
  
    try {
        const result = await query('CALL CreateVerification(?, ?)', [userID, receipt_num]);
        const newVerificationID = result[0][0]?.verification_id;
        console.log('New Verification ID: ', newVerificationID);
        res.json({ verification_id: newVerificationID });
        
    } catch (err) {
        console.error('Error fetching verifier id:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// VERIFIER RECEIPT NUMBER
//Check if receipt number exists in the table
app.get('/verifier/receipt-number', async (req, res) => {
    const receipt_num = req.query.receipt_num;
    console.log(`VERIFIER RECEIPT NUMBER - Received request TO CHECK EXISTENCE of this official receipt number: ${receipt_num} `);
  
    try {
        // Query to check if the receipt number exists
        const results = await query('SELECT official_receiptnum FROM Transactions WHERE official_receiptnum = ?', [receipt_num]);
        console.log(`Result: `, results);

        if (results.length > 0) {
            const receiptNumber = results[0]?.official_receiptnum;
            console.log(`Official receipt number: `, receiptNumber);
            res.json({ message: 'Matched' }); 
        } else {
            console.log('No receipt number found');
            res.json({ message: null });
        }
    } catch (err) {
        console.error('Error fetching receipt items:', err.message);
        res.status(500).json({ error: err.message });
    }
}); 

// VERIFIER RECEIPT ITEMS 
//Retrieve items for the receipt in the database
app.get('/verifier/receipt-items', async (req, res) => {
     const receipt_num = req.query.receipt_num;
     console.log(`VERIFIER RECEIPT ITEMS - Received request TO GET ITEMS for this official receipt number: ${receipt_num}`);

     if (!receipt_num) {
         console.error('VERIFIER RECEIPT ITEMS - Receipt number is required');
         return res.status(400).json({ error: 'Receipt number is required' });
     }
 
     try {
         const result = await query('SELECT product_name, price, quantity, total_cost FROM TransactionItems WHERE official_receiptnum = ?', [receipt_num]);
         console.log(`VERIFIER RECEIPT ITEMS - Receipt items fetched successfully for receipt number: ${receipt_num}`);
         console.log('VERIFIER RECEIPT ITEMS - Retrieved receipt items: ', result);
         res.json(result);
     } catch (err) {
         console.error('Error fetching receipt items:', err.message);
         res.status(500).json({ error: err.message });
     }
});

// VERIFIER RECEIPT TOTAL
//Retrieves total of the receipt from the database
app.get('/verifier/receipt/total/:receipt_num', async (req, res) => {
    const { receipt_num } = req.params;
    console.log(' VERIFIER RECEIPT TOTAL - Received request TO GET TOTAL for receipt number: ', receipt_num);

    try {
        const result = await query('SELECT total_cost FROM Transactions WHERE official_receiptnum = ?', [receipt_num]);
        
        // Log the raw result to understand its structure
        console.log('Raw result:', result);

        // Check the result structure
        if (result.length > 0) {
            const total = result[0]?.total_cost || 0;
            console.log('CHECKOUT TOTAL - Total amount for receipt number:', receipt_num, 'is:', total);
            res.json({ total });
        } else {
            console.log('CHECKOUT TOTAL - No data found for receipt number:', receipt_num);
            res.json({ total: 0 });
        }
    } catch (err) {
        console.error('Error fetching receipt total:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// UPDATE VERIFICATION STATUS
app.post('/verifier/verification/status', async (req,res) => {
    const verification_id = req.query.verification_id;
    console.log(`END SESSION - Received request TO UPDATE STATUS for this verification ID: ${verification_id}`);

    try {
        const result = await query('CALL UpdateVerStatus(?)', [verification_id]);
        console.log('Result: ', result);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }

});


// Set up the server
const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

server.setTimeout(60000); // Set timeout to 10 seconds (10000 milliseconds)


