const bcrypt = require('bcrypt');

const User = require('../models/user');

let register = async (req, res, next) => {
    let email = req.body.email;
    if (email === undefined) return res.status(400).send('The email field does not exist');
    let admin = await User.findOne({ where: { email, role_id: 1 } });
    if (admin) return res.status(409).send("Email already exists");
    else {
        try {
            let hashPassword = bcrypt.hashSync(req.body.password, 10);
            let newAdmin = { email: email, password: hashPassword, role_id: 1 };
            let createAdmin = await User.create(newAdmin);
            return res.send(createAdmin);
        } catch (err) {
            console.log(err);
            return res.status(400).send("There was an error creating the account, please try again");
        }
    }
}

let login = async (req, res, next) => {
    let email = req.body.email;
    if (email === undefined) return res.status(400).send('The email field does not exist');
    let password = req.body.password;
    if (password === undefined) return res.status(400).send('The password field does not exist');

    try {
        let admin = await User.findOne({ where: { email, role_id: 1 } });
        if (!admin) {
            return res.status(401).send("Email is incorrect");
        }

        let isPasswordValid = bcrypt.compareSync(password, admin.password);
        if (!isPasswordValid) {
            return res.status(401).send("Password is incorrect");
        }

        return res.send({ email: admin.email });
    } catch (err) {
        console.log(err);
        return res.status(400).send("There was an error creating the account, please try again");
    }
}

module.exports = {
    register,
    login,
};
