const { Op } = require("sequelize");

const Coupon = require('../models/codediscount');

let create = async (req, res, next) => {
    let code = req.body.code;
    if (code === undefined) return res.status(400).send('Trường code không tồn tại');
    let status = req.body.status;
    if (status === undefined) return res.status(400).send('Trường status không tồn tại');
    let money = parseInt(req.body.money);
    if (money === undefined) return res.status(400).send('Trường money không tồn tại');
    try {
        let newProduct = await Coupon.create({ code, status, money });
        return res.send(newProduct);
    } catch (e) {
        console.log(e);
        return res.status(500).send(e);
    }
}

let listAdminSide = async (req, res, next) => {
    let listCoupon = await Coupon.findAll({
        attributes: ['id','code', 'money', 'status', 'created_at'],
        order: [['created_at', 'DESC']]
    });
    return res.send(listCoupon);
}

let listCustomer = async (req, res, next) => {
    let whereClause = {};
    whereClause.status = 0;
    let listCoupon = await Coupon.findAll({
        attributes: ['id','code', 'money', 'status', 'created_at'],
        order: [['created_at', 'DESC']],
        where: whereClause
    });
    return res.send(listCoupon);
}

let onStatus = async (req, res, next) => {
    try {
        let id = req.body.id;
        if (id === undefined) return res.status(400).send('Trường id không tồn tại');
        await Coupon.update(
            { status: 1 },
            { where: { id: id } }
        )
        return res.send({ message: 'Disable coupon thành công!' })
    } catch (err) {
        console.log(err)
        return res.status(500).send('Gặp lỗi khi tải dữ liệu vui lòng thử lại');
    }
}

let offStatus = async (req, res, next) => {
    try {
        let id = req.body.id;
        if (id === undefined) return res.status(400).send('Trường id không tồn tại');
        await Coupon.update(
            { status: 0 },
            { where: { id: id } }
        )
        return res.send({ message: 'Kích hoạt coupon thành công!' })
    } catch (err) {
        console.log(err)
        return res.status(500).send('Gặp lỗi khi tải dữ liệu vui lòng thử lại');
    }
}


let deleteCoupon = async (req, res, next) => {
    let id = req.body.id;
    if (id === undefined) return res.status(400).send('Trường id không tồn tại');
    try {
        await Coupon.destroy(
            { where: { id: id } }
        )
        return res.send({ message: 'Xóa biến thể sản phẩm thành công' })
    } catch (err) {
        console.log(err)
        return res.status(500).send('Gặp lỗi khi tải dữ liệu vui lòng thử lại');
    }
}

let update = async (req, res, next) => {
        let id = parseInt(req.body.id);
        if (id === undefined) return res.status(400).send('Trường id không tồn tại');
        let money = parseInt(req.body.money);
        if (money === undefined) return res.status(400).send('Trường money không tồn tại');
        let code = req.body.code;
        if (code === undefined) return res.status(400).send('Trường code không tồn tại');
        try {
            await Coupon.update(
                { money: money, code: code },
                { where: { id: id } }
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
        let couponDetail = await Coupon.findOne({
            attributes: ['id', 'money', 'code' ],
            where: { id },
        });
        if (couponDetail) {
            return res.send(couponDetail);
        } else {
            return res.status(400).send('Mã giảm giá này không tồn tại');
        }
    } catch (err) {
        console.log(err);
        return res.status(500).send('Gặp lỗi khi tải dữ liệu vui lòng thử lại');
    }
}

module.exports = {
    create,
    listAdminSide,
    listCustomer,
    onStatus,
    offStatus,
    deleteCoupon,
    update,
    detailAdminSide
};