const jwt = require("jsonwebtoken");


// custom middleware to check if user is logged in
function auth(req, res, next) {
    
    // get existing token first
    const token = req.cookies.token;

    // if there is no token, you are not authorized
    if(!token) {
        return res.status(401).json({
            message: 'Unauthorized'
        })
    }

    // if we have token and 
    try{

        // to check if its the right token or tampered
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // if tampered then return error
        req.user=decoded;

        return next();
 
    } catch(err){ // if token is tampered
        return res.status(401).json({
            message: 'Tampered token Unauthorized'
        })

    }
}

module.exports = auth;