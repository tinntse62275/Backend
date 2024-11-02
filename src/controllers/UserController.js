const { Op } = require("sequelize");

const CustomerInfo = require('../models/customer_info');



let listAdminSide = async (req, res, next) => {
    let list = await CustomerInfo.findAll({
        attributes: ['customer_info_id', 'customer_name' , 'phone_number' , 'address' , 'point', 'user_id']
    });
    return res.send(list);
}

let deleteUser = async (req, res, next) => {
    let customer_info_id  = req.body.customer_info_id ;
    if (customer_info_id  === undefined) return res.status(400).send('Trường customer_info_id  không tồn tại');
    try {
        await CustomerInfo.destroy(
            { where: { customer_info_id : customer_info_id  } }
        )
        return res.send({ message: 'Xóa biến thể sản phẩm thành công' })
    } catch (err) {
        console.log(err)
        return res.status(500).send('Gặp lỗi khi tải dữ liệu vui lòng thử lại');
    }
}

let update = async (req, res, next) => {
    let customer_info_id = parseInt(req.body.customer_info_id);
    if (customer_info_id === undefined) return res.status(400).send('Trường customer_info_id không tồn tại');
    let customer_name = req.body.customer_name;
    if (customer_name === undefined) return res.status(400).send('Trường customer_name không tồn tại');
    let phone_number = req.body.phone_number;
    if (phone_number === undefined) return res.status(400).send('Trường phone_number không tồn tại');
    let address = req.body.address;
    if (address === undefined) return res.status(400).send('Trường address không tồn tại');
    let point = parseInt(req.body.point);
    if (point === undefined) return res.status(400).send('Trường point không tồn tại');
    try {
        await CustomerInfo.update(
            { address, phone_number, customer_name, point },
            { where: { customer_info_id: customer_info_id } }
        )
        return res.send({ message: 'Update thành công!' })
    } catch (err) {
        console.log(err)
        return res.status(500).send('Gặp lỗi khi tải dữ liệu vui lòng thử lại');
    }
}

let detailAdminSide = async (req, res, next) => {
    let id = req.params.id;
    if (id === undefined) return res.status(400).send('Trường id không tồn tại');
    try {
        let Detail = await CustomerInfo.findOne({
            attributes: ['customer_info_id', 'customer_name' , 'phone_number' , 'address' , 'point', 'user_id'],
            where: { customer_info_id : id },
        });
        if (Detail) {
            return res.send(Detail);
        } else {
            return res.status(400).send('Mã giảm giá này không tồn tại');
        }
    } catch (err) {
        console.log(err);
        return res.status(500).send('Gặp lỗi khi tải dữ liệu vui lòng thử lại');
    }
}


module.exports = {
    listAdminSide,
    deleteUser,
    update,
    detailAdminSide
};