const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { jwtDecode } = require('jwt-decode');

const User = require('../models/user');
const Customer_Info = require('../models/customer_info');

let register = async (req, res, next) => {
    let email = req.body.email;
    if (email === undefined) return res.status(400).send({ message: 'Please enter your Email' });
    let password = req.body.password;
    if (password === undefined) return res.status(400).send({ message: 'Please enter your Password' });
    let customer_name = req.body.customer_name;
    if (customer_name === undefined) return res.status(400).send({ message: 'Please enter your Full Name' });
    let phone_number = req.body.phone_number;
    if (phone_number === undefined) return res.status(400).send({ message: 'Please enter your Phone Number' });

    let customer = await User.findOne({ where: { email, role_id: 2 } });
    if (customer) return res.status(409).send({ message: 'Email already exists' });
    else {
        try {
            let hashPassword = bcrypt.hashSync(password, 10);
            let newCustomer = await User.create({ email: email, password: hashPassword, role_id: 2 });
            await Customer_Info.create({ user_id: newCustomer.user_id, customer_name, phone_number });

            const accessToken = jwt.sign(
                { customer_id: newCustomer.user_id },
                process.env.ACCESSTOKEN_SECRET_KEY,
                { expiresIn: process.env.ACCESSTOKEN_EXPIRES_IN }
            );

            const { exp } = jwtDecode(accessToken);
            const accessTokenExpires = exp;

            const refreshToken = jwt.sign(
                { customer_id: newCustomer.user_id },
                process.env.REFRESHTOKEN_SECRET_KEY,
                { expiresIn: process.env.REFRESHTOKEN_EXPIRES_IN }
            );

            res.cookie('refresh_token', refreshToken, {
                httpOnly: true,
                path: '/',
                sameSite: 'strict'
            });
            return res.send({
                access_token: accessToken,
                access_token_expires: accessTokenExpires,
            });
        } catch (err) {
            console.log(err);
            return res.status(500).send({ message: 'An error occurred, please try again' });
        }
    }
}

let login = async (req, res, next) => {
    let email = req.body.email;
    if (email === undefined) return res.status(400).send({ message: 'Email or Password is incorrect' });
    let password = req.body.password;
    if (password === undefined) return res.status(400).send({ message: 'Email or Password is incorrect' });

    try {
        let customer = await User.findOne({
            where: { email, role_id: 2 },
        });
        if (!customer) {
            return res.status(401).send({ message: 'Email or Password is incorrect' });
        }

        let isPasswordValid = bcrypt.compareSync(password, customer.password);
        if (!isPasswordValid) {
            return res.status(401).send({ message: 'Email or Password is incorrect' });
        }

        const accessToken = jwt.sign(
            { customer_id: customer.user_id },
            process.env.ACCESSTOKEN_SECRET_KEY,
            { expiresIn: process.env.ACCESSTOKEN_EXPIRES_IN }
        );

        const { exp } = jwtDecode(accessToken);
        const accessTokenExpires = exp;

        const refreshToken = jwt.sign(
            { customer_id: customer.user_id },
            process.env.REFRESHTOKEN_SECRET_KEY,
            { expiresIn: process.env.REFRESHTOKEN_EXPIRES_IN }
        );

        res.cookie('refresh_token', refreshToken, {
            httpOnly: true,
            path: '/',
            sameSite: 'strict'
        });
        return res.send({
            access_token: accessToken,
            access_token_expires: accessTokenExpires
        });
    } catch (err) {
        console.log(err);
        return res.status(400).send({ message: 'An error occurred, please try again' });
    }
}

let logout = async (req, res, next) => {
    res.clearCookie('refresh_token');
    return res.send({ message: 'Logout successful' });
}

let refreshAccessToken = async (req, res, next) => {
    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken === undefined) return res.status(400).send({ message: 'Refresh Token is invalid' });
    try {
        const { iat, exp, ...payload } = jwt.verify(refreshToken, process.env.REFRESHTOKEN_SECRET_KEY);

        const newAccessToken = jwt.sign(
            payload,
            process.env.ACCESSTOKEN_SECRET_KEY,
            { expiresIn: process.env.ACCESSTOKEN_EXPIRES_IN }
        );

        const decode = jwtDecode(newAccessToken);
        const newAccessTokenExpires = decode.exp;

        const newRefreshToken = jwt.sign(
            payload,
            process.env.REFRESHTOKEN_SECRET_KEY,
            { expiresIn: process.env.REFRESHTOKEN_EXPIRES_IN }
        );

        res.cookie('refresh_token', newRefreshToken, {
            httpOnly: true,
            path: '/',
            sameSite: 'strict'
        });
        return res.send({
            access_token: newAccessToken,
            access_token_expires: newAccessTokenExpires
        });
    } catch (error) {
        console.log(error);
        return res.status(400).send({ message: 'Refresh Token is invalid' });
    }
}

let getInfor = async (req, res, next) => {
    const customerId = req.token.customer_id;
    if (!customerId) return res.status(400).send({ message: 'Access Token is invalid' });

    try {
        const customer = await User.findOne({
            where: { user_id: customerId, role_id: 2 },
            include: [
                { model: Customer_Info, attributes: ['customer_name', 'phone_number', 'address'] },
            ]
        });

        return res.send({
            email: customer.email,
            customer_name: customer.Customer_Info.customer_name,
            phone_number: customer.Customer_Info.phone_number,
            address: customer.Customer_Info.address,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).send({ message: 'An error occurred, please try again' });
    }
}

let update = async (req, res, next) => {
    const user_id = req.token.customer_id;
    if (!user_id) return res.status(400).send({ message: 'Access Token is invalid' });
    const customer_name = req.body.customer_name;
    if (customer_name === undefined) return res.status(400).send({ message: 'customer_name field does not exist' });
    const phone_number = req.body.phone_number;
    if (phone_number === undefined) return res.status(400).send({ message: 'phone_number field does not exist' });
    const address = req.body.address;
    if (address === undefined) return res.status(400).send({ message: 'address field does not exist' });

    try {
        const customer = await User.findOne({ where: { user_id, role_id: 2 } });
        if (!customer) return res.status(409).send({ message: 'Customer does not exist' });

        const numberUpdate = await Customer_Info.update(
            { customer_name, phone_number, address },
            { where: { user_id } }
        )
        if (numberUpdate) {
            return res.send({
                customer_name,
                phone_number,
                address
            });
        } else {
            return res.status(500).send({ message: 'An error occurred, please try again' });
        }
    } catch (err) {
        console.log(err);
        return res.status(500).send({ message: 'An error occurred, please try again' });
    }
}

module.exports = {
    register,
    login,
    logout,
    refreshAccessToken,
    getInfor,
    update
};
