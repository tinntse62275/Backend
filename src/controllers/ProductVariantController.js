const fs = require("fs");

const Product = require('../models/product');
const Product_Variant = require('../models/product_variant');
const Product_Image = require('../models/product_image');
const Product_Price_History = require('../models/product_price_history');
const uploadImage = require('../midlewares/uploadImage');

let create = async (req, res, next) => {
    uploadImage(req, res, async (err) => {
        if (err) {
            console.log(err);
            return res.status(400).send(err);
        }
        let quantity = parseInt(req.body.quantity);
        if (quantity === undefined) return res.status(400).send('The quantity field does not exist');
        let product_id = parseInt(req.body.product_id);
        if (product_id === undefined) return res.status(400).send('The product_id field does not exist');
        let colour_id = parseInt(req.body.colour_id);
        if (colour_id === undefined) return res.status(400).send('The colour_id field does not exist');
        let size_id = parseInt(req.body.size_id);
        if (size_id === undefined) return res.status(400).send('The size_id field does not exist');
        let files = req.files;
        if (files === undefined) return res.status(400).send('The files field does not exist');

        try {
            let data = {
                quantity,
                product_id,
                colour_id,
                size_id
            };
            let newProductVariant = await Product_Variant.create(data);
            for (let file of files) {
                let data = {
                    path: 'http://localhost:8080/static/images/' + file.path.slice(-40, file.path.length),
                    product_variant_id: newProductVariant.product_variant_id
                }
                let newProductImage = await Product_Image.create(data);
            }
            return res.send(newProductVariant)
        } catch (err) {
            console.log(err);
            return res.status(500).send('An error occurred while loading data, please try again');
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
        if (product_variant_id === undefined) return res.status(400).send('The product_variant_id field does not exist');
        let quantity = parseInt(req.body.quantity);
        if (quantity === undefined) return res.status(400).send('The quantity field does not exist');
        let files = req.files;
        if (files === undefined) return res.status(400).send('The files field does not exist');

        try {
            let productVariant = await Product_Variant.findOne({
                where: { product_variant_id },
                include: { model: Product_Image, attributes: ['image_id', 'path'] }
            });
            if (!productVariant) return res.status(400).send('This product variant does not exist');

            for (let file of files) {
                fileName = file.path.slice(-40, file.path.length)
                let path = 'http://localhost:8080/static/images/' + fileName
                await Product_Image.create({
                    path,
                    product_variant_id
                });
            }

            for (let { image_id, path } of productVariant.Product_Images) {
                let directoryPath = __basedir + '\\public\\images\\'
                let fileName = path.slice(-40, path.length)
                fs.unlinkSync(directoryPath + fileName)
                await Product_Image.destroy({ where: { image_id } })
            }

            await productVariant.update({ quantity })

            return res.send({ message: "Successfully updated product variant!" })
        } catch (err) {
            console.log(err);
            return res.status(500).send('An error occurred while loading data, please try again');
        }
    })
}

let onState = async (req, res, next) => {
    try {
        let product_variant_ids = req.body.product_variant_ids;
        if (product_variant_ids === undefined) return res.status(400).send('The product_variant_ids field does not exist');
        await Product_Variant.update(
            { state: true },
            { where: { product_variant_id: product_variant_ids } }
        )
        return res.send({ message: 'Successfully activated the product variant for sale!' })
    } catch (err) {
        console.log(err)
        return res.status(500).send('An error occurred while loading data, please try again');
    }
}

let offState = async (req, res, next) => {
    try {
        let product_variant_ids = req.body.product_variant_ids;
        if (product_variant_ids === undefined) return res.status(400).send('The product_variant_ids field does not exist');
        Product_Variant.update(
            { state: false },
            { where: { product_variant_id: product_variant_ids } }
        )
        return res.send({ message: 'Successfully deactivated the product variant!' })
    } catch (err) {
        console.log(err)
        return res.status(500).send('An error occurred while loading data, please try again');
    }
}

let updateQuantity = async (req, res, next) => {
    try {
        let product_variant_ids = req.body.product_variant_ids;
        if (product_variant_ids === undefined) return res.status(400).send('The product_variant_ids field does not exist');
        let newQuantity = req.body.quantity;
        if (newQuantity === undefined) return res.status(400).send('The quantity field does not exist');

        await Product_Variant.update(
            { quantity: newQuantity },
            { where: { product_variant_id: product_variant_ids } }
        )
        return res.send({ message: 'Successfully updated the inventory for the product variant!' })
    } catch (err) {
        console.log(err)
        return res.status(500).send('An error occurred while loading data, please try again');
    }
}

let deleteProductVariant = async (req, res, next) => {
    let product_variant_ids = req.body.product_variant_ids;
    if (product_variant_ids === undefined) return res.status(400).send('The product_variant_ids field does not exist');

    try {
        let productVariant
        for (let product_variant_id of product_variant_ids) {
            productVariant = await Product_Variant.findOne({ where: { product_variant_id } });
            if (!productVariant) return res.status(400).send('This product variant does not exist');
        }

        await Product_Variant.destroy(
            { where: { product_variant_id: product_variant_ids } }
        )

        let product_id = productVariant.product_id
        let product = await Product.findOne({ where: { product_id } })
        let count = await product.countProduct_variants()
        if (count == 0) await product.destroy()

        return res.send({ message: 'Successfully deleted the product variant' })
    } catch (err) {
        console.log(err)
        return res.status(500).send('An error occurred while loading data, please try again');
    }
}

let detailCustomerSide = async (req, res, next) => {
    let product_id = req.params.product_id;
    if (product_id === undefined) return res.status(400).send('The product_id field does not exist');
    let colour_id = req.params.colour_id;
    if (colour_id === undefined) return res.status(400).send('The colour_id field does not exist');
    let size_id = req.params.size_id;
    if (size_id === undefined) return res.status(400).send('The size_id field does not exist');

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
        return res.status(500).send('An error occurred while loading data, please try again');
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
