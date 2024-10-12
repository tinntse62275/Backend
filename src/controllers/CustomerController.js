const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { jwtDecode } = require('jwt-decode');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/user');
const Customer_Info = require('../models/customer_info');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Hàm tạo mã OTP (6 chữ số)


let register = async (req, res, next) => {
    let email = req.body.email;
    if (email === undefined) return res.status(400).send({ message: 'Vui lòng nhập Email của bạn' });
    let password = req.body.password;
    if (password === undefined) return res.status(400).send({ message: 'Vui lòng nhập Mật khẩu của bạn' });
    let customer_name = req.body.customer_name;
    if (customer_name === undefined) return res.status(400).send({ message: 'Vui lòng nhập Họ và Tên của bạn' });
    let phone_number = req.body.phone_number;
    if (phone_number === undefined) return res.status(400).send({ message: 'Vui lòng nhập Số điện thoại của bạn' });

    let customer = await User.findOne({ where: { email, role_id: 2 } });
    if (customer) return res.status(409).send({ message: 'Email đã tồn tại' });
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
            return res.status(500).send({ message: 'Có lỗi xảy ra vui lòng thử lại' });
        }
    }
}

let login = async (req, res, next) => {
    let email = req.body.email;
    if (email === undefined) return res.status(400).send({ message: 'Email hoặc Mật khẩu không đúng' });
    let password = req.body.password;
    if (password === undefined) return res.status(400).send({ message: 'Email hoặc Mật khẩu không đúng' });

    try {
        let customer = await User.findOne({
            where: { email, role_id: 2 },
        });
        if (!customer) {
            return res.status(401).send({ message: 'Email hoặc Mật khẩu không đúng' });
        }

        let isPasswordValid = bcrypt.compareSync(password, customer.password);
        if (!isPasswordValid) {
            return res.status(401).send({ message: 'Email hoặc Mật khẩu không đúng' });
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
        return res.status(400).send({ message: 'Có lỗi xảy ra, vui lòng thử lại' });
    }
}

let logout = async (req, res, next) => {
    res.clearCookie('refresh_token');
    return res.send({ message: 'Đăng xuất thành công' });
}

let refreshAccessToken = async (req, res, next) => {
    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken === undefined) return res.status(400).send({ message: 'Refresh Token không hợp lệ' });
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
        return res.status(400).send({ message: 'Refresh Token không hợp lệ' });
    }
}

let getInfor = async (req, res, next) => {
    const customerId = req.token.customer_id;
    if (!customerId) return res.status(400).send({ message: 'Access Token không hợp lệ' });

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
        return res.status(500).send({ message: 'Có lỗi xảy ra, vui lòng thử lại' });
    }
}

let update = async (req, res, next) => {
    const user_id = req.token.customer_id;
    if (!user_id) return res.status(400).send({ message: 'Access Token không hợp lệ' });
    const customer_name = req.body.customer_name;
    if (customer_name === undefined) return res.status(400).send({ message: 'Trường customer_name không tồn tại' });
    const phone_number = req.body.phone_number;
    if (phone_number === undefined) return res.status(400).send({ message: 'Trường phone_number không tồn tại' });
    const address = req.body.address;
    if (address === undefined) return res.status(400).send({ message: 'Trường address không tồn tại' });

    try {
        const customer = await User.findOne({ where: { user_id, role_id: 2 } });
        if (!customer) return res.status(409).send({ message: 'Customer không tồn tại' });

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
            return res.status(500).send({ message: 'Có lỗi xảy ra, vui lòng thử lại' });
        }
    } catch (err) {
        console.log(err);
        return res.status(500).send({ message: 'Có lỗi xảy ra, vui lòng thử lại' });
    }
}

const googleLogin = async (req, res, next) => {
    const { email, password, username, phone } = req.body;
    try {
        // Kiểm tra xem email đã tồn tại trong database chưa
        let customer = await User.findOne({ where: { email, role_id: 2 } });

        if (!customer) {
            // Nếu chưa tồn tại, thêm mới người dùng
            let hashPassword = bcrypt.hashSync(password, 10);
            customer = await User.create({ email: email, password: hashPassword, role_id: 2 });
            console.log(customer)
            await Customer_Info.create({ user_id: customer.dataValues.user_id, customer_name: username });
        }

        // Tạo JWT cho người dùng
        const accessToken = jwt.sign(
            { customer_id: customer.user_id },
            process.env.ACCESSTOKEN_SECRET_KEY,
            { expiresIn: process.env.ACCESSTOKEN_EXPIRES_IN }
        );

        const { exp } = jwt.decode(accessToken);
        const accessTokenExpires = exp;

        const refreshToken = jwt.sign(
            { customer_id: customer.user_id },
            process.env.REFRESHTOKEN_SECRET_KEY,
            { expiresIn: process.env.REFRESHTOKEN_EXPIRES_IN }
        );

        // Thiết lập cookie refresh token
        res.cookie('refresh_token', refreshToken, {
            httpOnly: true,
            path: '/',
            sameSite: 'strict',
        });

        // Trả về token và thông tin cần thiết
        return res.send({
            access_token: accessToken,
            access_token_expires: accessTokenExpires,
        });

    } catch (err) {
        console.error("Error logging in with Google:", err);
        return res.status(500).send({ message: 'Có lỗi xảy ra, vui lòng thử lại' });
    }
};

const otpStorage = {};

// Lưu OTP
const saveOtp = (email, otp) => {
    const expiresAt = Date.now() + 5 * 60 * 1000; // Hết hạn sau 5 phút
    otpStorage[email] = { otp, expiresAt };
};

// Kiểm tra OTP
const verifyOtp = (email, otp) => {
    const entry = otpStorage[email];
    if (!entry) return false; // Không tìm thấy OTP

    if (entry.otp !== otp) return false; // OTP không đúng
    if (Date.now() > entry.expiresAt) return false; // OTP đã hết hạn

    // Xóa OTP sau khi xác thực thành công
    delete otpStorage[email];
    return true; // Xác thực thành công
};

const forgotPassword = async (req, res, next) => {
    const { email } = req.body;

    try {
        let user = await User.findOne({ where: { email, role_id: 2 } });
        if (!user) return res.status(404).json({ message: 'Email không tồn tại' });

        // Tạo OTP ngẫu nhiên (gồm 6 chữ số)
        const otp = crypto.randomInt(100000, 999999).toString();

        // Lưu OTP vào bộ nhớ tạm thời
        saveOtp(email, otp);

        // Cấu hình và gửi email
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'OTP Quên Mật Khẩu',
            text: `Mã OTP của bạn là: ${otp}. Mã này sẽ hết hạn trong 5 phút.`
        };

        await transporter.sendMail(mailOptions);

        return res.status(200).json({ message: 'OTP đã được gửi tới email của bạn' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Có lỗi xảy ra, vui lòng thử lại sau' });
    }
};

const verifyOtpController = async (req, res, next) => {
    const { email, otp } = req.body;

    try {
        const isValid = verifyOtp(email, otp);
        if (!isValid) return res.status(400).json({ message: 'OTP không hợp lệ hoặc đã hết hạn' });

        return res.status(200).json({ message: 'OTP xác thực thành công' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Có lỗi xảy ra, vui lòng thử lại sau' });
    }
};

const resetPassword = async (req, res, next) => {
    const { email, newPassword } = req.body;

    // Kiểm tra đầu vào
    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
    }

    try {
        // Tìm user trong DB
        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(404).json({ message: 'Email không tồn tại' });

        // Mã hóa mật khẩu mới
        const hashPassword = bcrypt.hashSync(newPassword, 10);

        // Cập nhật mật khẩu mới cho user
        user.password = hashPassword;
        await user.save();

        return res.status(200).json({ message: 'Đổi mật khẩu thành công' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Có lỗi xảy ra, vui lòng thử lại sau' });
    }
};

module.exports = {
    register,
    login,
    logout,
    refreshAccessToken,
    getInfor,
    update,
    googleLogin,
    forgotPassword,
    verifyOtpController,
    resetPassword,
};
