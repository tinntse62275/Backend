const orderid = require('order-id')('key');
const { Sequelize } = require('sequelize');
const { Op } = require("sequelize");

const Order = require('../models/order');
const User = require('../models/user');
const Customer_Info = require('../models/customer_info');
const Order_State = require('../models/order_state');
const Product_Variant = require('../models/product_variant');
const Product = require('../models/product');
const Product_Price_History = require('../models/product_price_history');
const Order_Item = require('../models/order_item');
const Feedback = require('../models/feedback');
const Order_Status_Change_History = require('../models/order_status_change_history');
const Colour = require('../models/colour');
const Size = require('../models/size');

let create = async (req, res, next) => {
    let customer_id = req.token.customer_id;
    if (!customer_id) return res.status(400).send({ message: 'Invalid Access Token' });
    let product_variant_id = req.body.product_variant_id;
    if (product_variant_id === undefined) return res.status(400).send('The product_variant_id field does not exist');
    let rate = req.body.rate;
    if (rate === undefined) return res.status(400).send('The rate field does not exist');
    let content = req.body.content;
    if (content === undefined) return res.status(400).send('The content field does not exist');

    // Check if the customer_id provided exists
    try {
        let customer = await User.findOne({ where: { user_id: customer_id, role_id: 2 } });
        if (customer == null) return res.status(400).send('This customer does not exist');
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error loading data, please try again');
    }

    // Check if the product_variant_id provided exists
    try {
        var productVariant = await Product_Variant.findOne({ where: { product_variant_id } });
        if (productVariant == null) return res.status(400).send('This Product Variant does not exist');
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error loading data, please try again');
    }

    // Check if feedback with customer_id and product_variant_id already exists
    try {
        let feedback = await Feedback.findOne({ where: { user_id: customer_id, product_variant_id } });
        if (feedback) return res.status(400).send('Feedback already exists');
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error loading data, please try again');
    }

    try {
        // Check if the customer with the corresponding ID has purchased the product with the provided product_variant_id
        let order = await Order.findOne({
            attributes: ['order_id', 'total_order_value'],
            include: [
                {
                    model: Order_Item, where: { product_variant_id }
                },
                {
                    model: Order_Status_Change_History, where: { state_id: 4 }
                },
            ],
            where: { user_id: customer_id },
        });

        if (order) {
            let feedback = await Feedback.create({ user_id: customer_id, product_variant_id, rate, content });

            // Retrieve all Feedback related to the product corresponding to the newly created feedback
            // calculate the average rate and count
            let product = await productVariant.getProduct();
            let product_id = product.product_id;
            let [result] = await Feedback.findAll({
                attributes: [
                    [Sequelize.fn('avg', Sequelize.col('rate')), 'avg'],
                    [Sequelize.fn('count', Sequelize.col('rate')), 'count']
                ],
                include: { model: Product_Variant, where: { product_id } },
            });

            // Update the Rating and feedbackQuantity for the corresponding product
            let rating = parseFloat(result.dataValues.avg);
            let feedback_quantity = parseInt(result.dataValues.count);
            await product.update({ rating, feedback_quantity });

            return res.send(feedback);
        } else {
            return res.status(400).send('Invalid Feedback');
        }
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error loading data, please try again');
    }
}

let update = async (req, res, next) => {
    let feedback_id = req.body.feedback_id;
    if (feedback_id === undefined) return res.status(400).send('The feedback_id field does not exist');
    let rate = req.body.rate;
    if (rate === undefined) return res.status(400).send('The rate field does not exist');
    let content = req.body.content;
    if (content === undefined) return res.status(400).send('The content field does not exist');

    try {
        let feedback = await Feedback.findOne({ where: { feedback_id } });
        if (!feedback) res.status(400).send('This Feedback does not exist');
        else {
            await feedback.update({ rate, content });

            // Retrieve all Feedback related to the product corresponding to the feedback just updated
            // calculate the average rate
            let productVariant = await feedback.getProduct_variant();
            let product = await productVariant.getProduct();
            let product_id = product.product_id;
            let [result] = await Feedback.findAll({
                attributes: [
                    [Sequelize.fn('avg', Sequelize.col('rate')), 'avg'],
                ],
                include: { model: Product_Variant, where: { product_id } },
            });

            // Update the Rating for the corresponding product
            let rating = parseFloat(result.dataValues.avg);
            await product.update({ rating });

            return res.send({ message: 'Feedback updated successfully!' });
        }
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error loading data, please try again');
    }
}

let detail = async (req, res, next) => {
    let customer_id = req.token.customer_id;
    if (!customer_id) return res.status(400).send({ message: 'Invalid Access Token' });
    let product_variant_id = req.params.product_variant_id;
    if (product_variant_id === undefined) return res.status(400).send('The product_variant_id field does not exist');
    try {
        let customer = await User.findOne({ where: { user_id: customer_id, role_id: 2 } });
        if (customer == null) return res.status(400).send('This customer does not exist');
        let productVariant = await Product_Variant.findOne({ where: { product_variant_id } });
        if (productVariant == null) return res.status(400).send('This Product Variant does not exist');

        let feedback = await Feedback.findOne({
            attributes: ['feedback_id', 'rate', 'content'],
            where: { user_id: customer_id, product_variant_id }
        });
        if (!feedback) res.status(400).send('This Feedback does not exist');
        else return res.send(feedback);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error loading data, please try again');
    }
}

let list = async (req, res, next) => {
    let product_id = req.params.product_id;
    if (product_id === undefined) return res.status(400).send('The product_id field does not exist');

    try {
        let product = await Product.findOne({ where: { product_id } });
        if (product == null) return res.status(400).send('This product does not exist');

        let feedbackList = await Feedback.findAll({
            attributes: ['rate', 'content', 'created_at'],
            include: [
                {
                    model: User,
                    include: [
                        { model: Customer_Info, attributes: ['customer_name'] }
                    ]
                },
                {
                    model: Product_Variant, where: { product_id },
                    include: [
                        { model: Colour, attributes: ['colour_name'] },
                        { model: Size, attributes: ['size_name'] },
                    ]
                },
            ],
            order: [['created_at', 'DESC']]
        });

        feedbackList = feedbackList.map((feedback) => {
            return {
                customer: feedback.User.Customer_Info.customer_name,
                rate: feedback.rate,
                colour: feedback.product_variant.Colour.colour_name,
                size: feedback.product_variant.Size.size_name,
                content: feedback.content,
                created_at: feedback.created_at
            }
        });

        return res.send(feedbackList);
    } catch (err) {
        console.log(err);
        return res.status(500).send('Error loading data, please try again');
    }
}

module.exports = {
    create,
    update,
    detail,
    list
};
