const { Op } = require("sequelize");

const Product_Variant = require('../models/product_variant');
const Product = require('../models/product');
const Colour = require('../models/colour');
const Size = require('../models/size');
const Product_Price_History = require('../models/product_price_history');
const Product_Image = require('../models/product_image');
const Category = require("../models/category");

let create = async (req, res, next) => {
    let product_name = req.body.product_name;
    if (product_name === undefined) return res.status(400).send('The product_name field does not exist');
    let category_id = req.body.category_id;
    if (category_id === undefined) return res.status(400).send(' category_id does not exist');
    let price = parseInt(req.body.price);
    if (price === undefined) return res.status(400).send('price does not exist');
    let description = req.body.description;
    if (description === undefined) return res.status(400).send('description does not exist');

    try {
        let newProduct = await Product.create({ product_name, description, category_id });
        let newProductPriceHistory = await Product_Price_History.create({
            product_id: newProduct.product_id,
            price: price
        });
        return res.send(newProduct);
    } catch (e) {
        console.log(e);
        return res.status(500).send(e);
    }
}

let update = async (req, res, next) => {
    let product_id = req.body.product_id;
    if (product_id === undefined) return res.status(400).send('product_id does not exist');
    let product_name = req.body.product_name;
    if (product_name === undefined) return res.status(400).send('The product_name field does not exist');
    let category_id = req.body.category_id;
    if (category_id === undefined) return res.status(400).send('category_id does not exist');
    let price = parseInt(req.body.price);
    if (price === undefined) return res.status(400).send('price does not exist');
    let description = req.body.description;
    if (description === undefined) return res.status(400).send('description does not exist');
    try {
        let category = await Category.findOne({ where: { category_id } });
        if (category == null) return res.status(400).send('Category does not exist');
        let product = await Product.findOne({ where: { product_id } });
        if (product == null) return res.status(400).send('Product does not exist');

        await Product_Price_History.create({ product_id, price })
        await product.update({ product_name, category_id, description })

        return res.send("Success")
    } catch (err) {
        console.log(err);
        return res.status(500).send('Has error when create order.');
    }
}

let listAdminSide = async (req, res, next) => {
    let listProductVariant = await Product_Variant.findAll({
        attributes: ['product_variant_id', 'quantity', 'state', 'created_at'],
        include: [
            {
                model: Product, attributes: ['product_id', 'product_name'],
                include: { model: Product_Price_History, attributes: ['price'], separate: true, order: [['created_at', 'DESC']] }
            },
            { model: Colour, attributes: ['colour_name'] },
            { model: Size, attributes: ['size_name'] },
            { model: Product_Image, attributes: ['path'] },
        ],
        order: [['created_at', 'DESC']]
    });
    listProductVariant = listProductVariant.map((productVariant) => {
        let newProductVariant = {
            product_id: productVariant.Product.product_id,
            product_variant_id: productVariant.product_variant_id,
            product_name: productVariant.Product.product_name,
            colour_name: productVariant.Colour.colour_name,
            size_name: productVariant.Size.size_name,
            product_image: productVariant.Product_Images[0].path,
            price: productVariant.Product.Product_Price_Histories[0].price,
            quantity: productVariant.quantity,
            state: productVariant.state,
            created_at: productVariant.created_at
        }
        return newProductVariant;
    });
    return res.send(listProductVariant);
}

let listCustomerSide = async (req, res, next) => {
    let category_id = Number(req.query.category);
    let whereClause;
    if (category_id != undefined && Number.isInteger(category_id))
        whereClause = { category_id }

    try {


        // Lấy danh sách tất cả sản phẩm ưu tiên sản phẩm mới nhất
        let listProduct = await Product.findAll({
            attributes: ['product_id'],
            order: [['created_at', 'DESC']],
            raw: true
        });

        let listProductVariant = [];

        // Duyệt qua danh sách sản phẩm
        for (let { product_id } of listProduct) {
            // Lấy danh sách tất cả các màu của sản phẩm đó
            let listColor = await Product_Variant.findAll({
                attributes: ['colour_id'],
                where: { product_id },
                group: ['colour_id'],
                raw: true
            });
            // Duyệt qua danh sách màu
            for (let { colour_id } of listColor) {
                // Tìm tất cả biến thể sản phẩm có cùng màu với nhau
                let listProductVariantSameColour = await Product_Variant.findAll({
                    attributes: ['product_variant_id', 'colour_id'],
                    include: [
                        {
                            model: Product, attributes: ['product_id', 'product_name', 'rating', 'sold', 'feedback_quantity'],
                            include: {
                                model: Product_Price_History,
                                attributes: ['price'],
                                separate: true, order: [['created_at', 'DESC']]
                            },
                            where: whereClause
                        },
                        { model: Colour, attributes: ['colour_name'] },
                        { model: Size, attributes: ['size_name'] },
                        { model: Product_Image, attributes: ['path'] },
                    ],
                    where: {
                        [Op.and]: [
                            { colour_id },
                            { state: true },
                            { quantity: { [Op.gt]: 0 } }
                        ]
                    },
                });
                // Convert dữ liệu
                if (listProductVariantSameColour.length) {
                    let productVariant = {
                        product_id: listProductVariantSameColour[0].Product.product_id,
                        product_name: listProductVariantSameColour[0].Product.product_name,
                        rating: listProductVariantSameColour[0].Product.rating,
                        sold: listProductVariantSameColour[0].Product.sold,
                        feedback_quantity: listProductVariantSameColour[0].Product.feedback_quantity,
                        product_variant_id: listProductVariantSameColour[0].product_variant_id,
                        colour_id: listProductVariantSameColour[0].colour_id,
                        colour_name: listProductVariantSameColour[0].Colour.colour_name,
                        price: listProductVariantSameColour[0].Product.Product_Price_Histories[0].price,
                        product_image: listProductVariantSameColour[0].Product_Images[0].path,
                        sizes: []
                    };
                    // Duyệt qua danh sách biến thể sản phẩm có cùng màu để cộng dồn danh sách sizes
                    for (let { Size } of listProductVariantSameColour)
                        productVariant.sizes.push(Size.size_name);
                    listProductVariant.push(productVariant);
                }
            }
        }
        return res.send(listProductVariant);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Has error when create order');
    }
}

let detailCustomerSide = async (req, res, next) => {
    let product_id = req.params.product_id;
    if (product_id === undefined) return res.status(400).send('product_id does not exist');

    try {
        let productDetail = await Product.findOne({
            attributes: ['product_id', 'product_name', 'description', 'rating', 'sold', 'feedback_quantity'],
            where: { product_id },
            raw: true
        });
        return res.send(productDetail);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Has error when create order');
    }
}

let detailAdminSide = async (req, res, next) => {
    let product_id = req.params.product_id;
    if (product_id === undefined) return res.status(400).send('product_id does not exist');

    try {
        let productDetail = await Product.findOne({
            attributes: ['product_id', 'product_name', 'category_id', 'description'],
            include: [
                { model: Category, attributes: ['title'] },
                { model: Product_Price_History, attributes: ['price'], separate: true, order: [['created_at', 'DESC']] },
                {
                    model: Product_Variant, attributes: ['product_variant_id', 'colour_id', 'size_id', 'quantity'],
                    include: [
                        { model: Colour, attributes: ['colour_name'] },
                        { model: Size, attributes: ['size_name'] },
                        { model: Product_Image, attributes: ['path'] }
                    ]
                }
            ],
            where: { product_id },
        });

        if (productDetail) {
            let productVariantList = productDetail.product_variants.map((productVariant) => {
                let productImages = productVariant.Product_Images.map(({ path }) => { return { path } })
                return {
                    product_variant_id: productVariant.product_variant_id,
                    colour_id: productVariant.colour_id,
                    colour_name: productVariant.Colour.colour_name,
                    size_id: productVariant.size_id,
                    size_name: productVariant.Size.size_name,
                    quantity: productVariant.quantity,
                    product_images: productImages
                }
            })
            productDetail = {
                product_id: productDetail.product_id,
                product_name: productDetail.product_name,
                category_id: productDetail.category_id,
                category_name: productDetail.Category.title,
                price: productDetail.Product_Price_Histories[0].price,
                description: productDetail.description,
                product_variant_list: productVariantList
            }
            return res.send(productDetail);
        } else {
            return res.status(400).send('Has error when create order not exist');
        }
    } catch (err) {
        console.log(err);
        return res.status(500).send('Has error when create order');
    }
}

let listColour = async (req, res, next) => {
    let product_id = req.params.product_id;
    if (product_id === undefined) return res.status(400).send('product_id does not exist');

    try {
        let listColour = await Product_Variant.findAll({
            attributes: ['colour_id'],
            include: [
                { model: Colour, attributes: ['colour_name'] },
            ],
            where: { product_id },
            group: ['colour_id'],
        });

        listColour = listColour.map((colour) => {
            let newColour = {
                colour_id: colour.colour_id,
                colour_name: colour.Colour.colour_name
            }
            return newColour;
        });

        return res.send(listColour);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Has error when create order');
    }
}

let listSize = async (req, res, next) => {
    let product_id = req.params.product_id;
    if (product_id === undefined) return res.status(400).send('product_id does not exist');
    let colour_id = req.params.colour_id;
    if (colour_id === undefined) return res.status(400).send('colour_id does not exist');

    try {
        let listSize = await Product_Variant.findAll({
            attributes: ['size_id'],
            include: [
                { model: Size, attributes: ['size_name'] },
            ],
            where: { product_id, colour_id, state: true },
        });

        listSize = listSize.map((size) => {
            let newSize = {
                size_id: size.size_id,
                size_name: size.Size.size_name
            }
            return newSize;
        });

        return res.send(listSize);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Has error when create order');
    }
}

module.exports = {
    create,
    update,
    listAdminSide,
    listCustomerSide,
    detailCustomerSide,
    detailAdminSide,
    listColour,
    listSize
};
