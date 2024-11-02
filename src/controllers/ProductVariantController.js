const fs = require("fs");

const Product = require('../models/product');
const Product_Variant = require('../models/product_variant');
const Product_Image = require('../models/product_image');
const Product_Price_History = require('../models/product_price_history');
const uploadImage = require('../midlewares/uploadImage');
const cloudinary = require('cloudinary').v2;
let create = async (req, res, next) => {
    uploadImage(req, res, async (err) => {
        if (err) {
            console.log(err);
            return res.status(400).send(err);
        }
        let quantity = parseInt(req.body.quantity);
        if (quantity === undefined) return res.status(400).send('Trường quantity không tồn tại');
        let product_id = parseInt(req.body.product_id);
        if (product_id === undefined) return res.status(400).send('Trường product_id không tồn tại');
        let colour_id = parseInt(req.body.colour_id);
        if (colour_id === undefined) return res.status(400).send('Trường colour_id không tồn tại');
        let size_id = parseInt(req.body.size_id);
        if (size_id === undefined) return res.status(400).send('Trường size_id không tồn tại');
        let files = req.files;
        if (files === undefined) return res.status(400).send('Trường files không tồn tại');

        try {
            let data = {
                quantity,
                product_id,
                colour_id,
                size_id
            };
            let newProductVariant = await Product_Variant.create(data);
            
            for (let file of files) {
                // file.path sẽ là URL của ảnh trên Cloudinary
                let data = {
                    path: file.path,
                    product_variant_id: newProductVariant.product_variant_id
                }
                await Product_Image.create(data);
            }
            
            return res.send(newProductVariant)
        } catch (err) {
            console.log(err);
            return res.status(500).send('Gặp lỗi khi tải dữ liệu vui lòng thử lại');
        }
    })
}

let update = async (req, res, next) => {
    uploadImage(req, res, async (err) => {
        if (err) {
            console.log(err);
            return res.status(400).send(err);
        }
        
        let product_variant_id = parseInt(req.body.product_variant_id);
        if (product_variant_id === undefined) return res.status(400).send('Trường product_variant_id không tồn tại');
        
        let quantity = parseInt(req.body.quantity);
        if (quantity === undefined) return res.status(400).send('Trường quantity không tồn tại');
        
        let files = req.files;
        if (files === undefined) return res.status(400).send('Trường files không tồn tại');

        try {
            let productVariant = await Product_Variant.findOne({
                where: { product_variant_id },
                include: { model: Product_Image, attributes: ['image_id', 'path'] }
            });
            
            if (!productVariant) return res.status(400).send('Product Variant này không tồn tại');

            // Xóa ảnh cũ trên Cloudinary và trong database
            for (let { image_id, path } of productVariant.Product_Images) {
                // Lấy public_id từ URL Cloudinary
                const public_id = path.split('/').slice(-1)[0].split('.')[0];
                
                // Xóa ảnh trên Cloudinary
                await cloudinary.uploader.destroy(`product_images/${public_id}`);
                
                // Xóa record trong database
                await Product_Image.destroy({ where: { image_id } });
            }

            // Lưu ảnh mới
            for (let file of files) {
                // file.path sẽ là URL của ảnh trên Cloudinary
                await Product_Image.create({
                    path: file.path,
                    product_variant_id
                });
            }

            await productVariant.update({ quantity });

            return res.send({ message: "Cập nhật biến thể sản phẩm thành công!" });
            
        } catch (err) {
            console.log(err);
            return res.status(500).send('Gặp lỗi khi tải dữ liệu vui lòng thử lại');
        }
    });
}

let onState = async (req, res, next) => {
    try {
        let product_variant_ids = req.body.product_variant_ids;
        if (product_variant_ids === undefined) return res.status(400).send('Trường product_variant_ids không tồn tại');
        await Product_Variant.update(
            { state: true },
            { where: { product_variant_id: product_variant_ids } }
        )
        return res.send({ message: 'Mở bán biến thể sản phẩm thành công!' })
    } catch (err) {
        console.log(err)
        return res.status(500).send('Gặp lỗi khi tải dữ liệu vui lòng thử lại');
    }
}

let offState = async (req, res, next) => {
    try {
        let product_variant_ids = req.body.product_variant_ids;
        if (product_variant_ids === undefined) return res.status(400).send('Trường product_variant_ids không tồn tại');
        Product_Variant.update(
            { state: false },
            { where: { product_variant_id: product_variant_ids } }
        )
        return res.send({ message: 'Tắt biến thể sản phẩm thành công!' })
    } catch (err) {
        console.log(err)
        return res.status(500).send('Gặp lỗi khi tải dữ liệu vui lòng thử lại');
    }
}

let updateQuantity = async (req, res, next) => {
    try {
        let product_variant_ids = req.body.product_variant_ids;
        if (product_variant_ids === undefined) return res.status(400).send('Trường product_variant_ids không tồn tại');
        let newQuantity = req.body.quantity;
        if (newQuantity === undefined) return res.status(400).send('Trường quantity không tồn tại');

        await Product_Variant.update(
            { quantity: newQuantity },
            { where: { product_variant_id: product_variant_ids } }
        )
        return res.send({ message: 'Cập nhật tồn kho cho biến thể sản phẩm thành công!' })
    } catch (err) {
        console.log(err)
        return res.status(500).send('Gặp lỗi khi tải dữ liệu vui lòng thử lại');
    }
}

let deleteProductVariant = async (req, res, next) => {
    let product_variant_ids = req.body.product_variant_ids;
    if (product_variant_ids === undefined) return res.status(400).send('Trường product_variant_ids không tồn tại');


    try {
        let productVariant
        for (let product_variant_id of product_variant_ids) {
            productVariant = await Product_Variant.findOne({ where: { product_variant_id } });
            if (!productVariant) return res.status(400).send('Product Variant này không tồn tại');
        }

        await Product_Variant.destroy(
            { where: { product_variant_id: product_variant_ids } }
        )

        let product_id = productVariant.product_id
        let product = await Product.findOne({ where: { product_id } })
        let count = await product.countProduct_variants()
        if (count == 0) await product.destroy()

        return res.send({ message: 'Xóa biến thể sản phẩm thành công' })
    } catch (err) {
        console.log(err)
        return res.status(500).send('Gặp lỗi khi tải dữ liệu vui lòng thử lại');
    }
}

let detailCustomerSide = async (req, res, next) => {
    let product_id = req.params.product_id;
    if (product_id === undefined) return res.status(400).send('Trường product_id không tồn tại');
    let colour_id = req.params.colour_id;
    if (colour_id === undefined) return res.status(400).send('Trường colour_id không tồn tại');
    let size_id = req.params.size_id;
    if (size_id === undefined) return res.status(400).send('Trường size_id không tồn tại');

    try {
        let productVariant = await Product_Variant.findOne({
            attributes: ['product_variant_id', 'quantity'],
            include: [
                {
                    model: Product, attributes: ['product_id'],
                    include: { model: Product_Price_History, attributes: ['price'], separate: true, order: [['created_at', 'DESC']] }
                },
                { model: Product_Image, attributes: ['path'] },
            ],
            where: { product_id, colour_id, size_id, state: true },
        });

        let newProductVariant = {
            product_variant_id: productVariant.product_variant_id,
            price: productVariant.Product.Product_Price_Histories[0].price,
            quantity: productVariant.quantity,
            product_images: []
        };

        for (let image of productVariant.Product_Images) {
            newProductVariant.product_images.push(image.path);
        }

        return res.send(newProductVariant);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Gặp lỗi khi tải dữ liệu vui lòng thử lại');
    }
}

module.exports = {
    create,
    update,
    onState,
    offState,
    updateQuantity,
    deleteProductVariant,
    detailCustomerSide
};
