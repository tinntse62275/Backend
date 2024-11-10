const bcrypt = require('bcrypt');

const User = require('../models/user');

let register = async (req, res, next) => {
    let email = req.body.email;
    if(email === undefined) return res.status(400).send('Trường email không tồn tại');
    let admin = await User.findOne({ where: { email, role_id: 1 } });
    if(admin) return res.status(409).send("Email đã tồn tại");
    else {
        try {
            let hashPassword = bcrypt.hashSync(req.body.password, 10);
            let newAdmin = { email: email, password: hashPassword, role_id: 1 };
            let createAdmin = await User.create(newAdmin);
            return res.send(createAdmin);
        } catch(err) {
            console.log(err);
            return res.status(400).send("Có lỗi trong quá trình tạo tài khoản vui lòng thử lại");
        }
    }
}

let login = async (req, res, next) => {
    let email = req.body.email;
    if (email === undefined) return res.status(400).send('Trường email không tồn tại');
    
    let password = req.body.password;
    if (password === undefined) return res.status(400).send('Trường password không tồn tại');

    try {
        // Tìm kiếm user với email và role_id là Admin (1) hoặc Staff (3)
        let user = await User.findOne({ 
            where: { 
                email, 
                role_id: [1, 3]  // Kiểm tra cả role Admin và Staff
            } 
        });

        if (!user) {
            return res.status(401).send("Email không chính xác hoặc người dùng không có quyền truy cập");
        }

        // Kiểm tra mật khẩu
        let isPasswordValid = bcrypt.compareSync(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).send("Mật khẩu không chính xác");
        }
        console.log("Role", user);
        // Đăng nhập thành công, trả về thông tin người dùng
        return res.send({ email: user.email, role_id: user.role_id });
    } catch (err) {
        console.log(err);
        return res.status(400).send("Có lỗi trong quá trình đăng nhập, vui lòng thử lại");
    }
};



module.exports = {
    register,
    login,
};
