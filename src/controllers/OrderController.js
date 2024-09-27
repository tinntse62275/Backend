const orderid = require('order-id')('key');

const Order = require('../models/order');
const User = require('../models/user');
const Order_State = require('../models/order_state');
const Product_Variant = require('../models/product_variant');
const Product = require('../models/product');
const Product_Price_History = require('../models/product_price_history');
const Order_Item = require('../models/order_item');
const Feedback = require('../models/feedback');
const Order_Status_Change_History = require('../models/order_status_change_history');

let create = async (req, res, next) => {
    let user_id = req.token.customer_id;
    if (!user_id) return res.status(400).send({ message: 'Invalid Access Token' });

    try {
        let user = await User.findOne({ where: { user_id, role_id: 2 } });
        if (user == null) return res.status(400).send('This user does not exist');
    } catch (err) {
        console.log(err);
        return res.status(500).send('An error occurred while creating the order, please try again');
    }

    let customer_name = req.body.customer_name;
    if (customer_name === undefined) return res.status(400).send('The customer_name field does not exist');
    let email = req.body.email;
    if (email === undefined) return res.status(400).send('The email field does not exist');
    let phone_number = req.body.phone_number;
    if (phone_number === undefined) return res.status(400).send('The phone_number field does not exist');
    let address = req.body.address;
    if (address === undefined) return res.status(400).send('The address field does not exist');
    let order_items = req.body.order_items;
    if (order_items === undefined) return res.status(400).send('The order_items field does not exist');

    try {
        let order_id = orderid.generate().replace(/-/g, "");
        var newOrder = await Order.create({
            user_id,
            order_id,
            customer_name,
            email,
            phone_number,
            address,
            total_product_value: 0,
            delivery_charges: 0,
            total_order_value: 0,
        });

        let total_product_value = 0;
        for (let i = 0; i < order_items.length; i++) {
            let order_item = order_items[i];
            let product_variant = await Product_Variant.findOne({
                attributes: ['product_variant_id', 'quantity', 'state'],
                include: [
                    {
                        model: Product, attributes: ['product_id'],
                        include: { model: Product_Price_History, attributes: ['price'], separate: true, order: [['created_at', 'DESC']] }
                    },
                ],
                where: { product_variant_id: order_item.product_variant_id }
            });

            if (product_variant == null)
                return res.status(400).send("This product does not exist");
            if (product_variant.state != true)
                return res.status(400).send("This product has not been launched for sale");
            if (order_item.quantity > product_variant.quantity)
                return res.status(400).send("The product quantity is not valid");

            let productVariantPrice = product_variant.Product.Product_Price_Histories[0].price;
            let total_value = productVariantPrice * order_item.quantity;
            let newOrderItem = {
                order_id: newOrder.order_id,
                product_variant_id: product_variant.product_variant_id,
                order_item_index: i,
                price: productVariantPrice,
                quantity: order_item.quantity,
                total_value
            }
            await Order_Item.create(newOrderItem);
            newProductVariantQuantity = product_variant.quantity - order_item.quantity;
            product_variant.update({ quantity: newProductVariantQuantity });
            total_product_value += total_value;
        }

        let delivery_charges = 20000;
        let total_order_value = total_product_value + delivery_charges;
        newOrder.update({ total_product_value, delivery_charges, total_order_value });
        let state = await Order_State.findOne({ where: { state_id: 1, state_name: "Pending Confirmation" } });
        await newOrder.addOrder_State(state);
        return res.send(newOrder);
    } catch (err) {
        console.log(err);
        return res.status(500).send('An error occurred while creating the order, please try again');
    }
}


let listAdminSide = async (req, res, next) => {
    try {
        let orderList = await Order.findAll({
            attributes: ['order_id', 'total_order_value'],
            include: [
                {
                    model: Order_Status_Change_History, where: { state_id: 1 }
                },
            ],
            order: [
                [Order_Status_Change_History, 'created_at', 'DESC']
            ]
        });

        orderList = await Promise.all(orderList.map(async (order) => {
            let stateList = await order.getOrder_States();
            let state = stateList.pop();
            let newOrder = {
                order_id: order.order_id,
                total_order_value: order.total_order_value,
                state_id: state.state_id,
                state_name: state.state_name,
                created_at: order.Order_Status_Change_Histories[0].created_at
            };
            return newOrder;
        }));

        return res.send(orderList);
    } catch (err) {
        console.log(err);
        return res.status(500).send('An error occurred while loading data, please try again');
    }
}

let listCustomerSide = async (req, res, next) => {
    let customer_id = req.token.customer_id;
    if (!customer_id) return res.status(400).send({ message: 'Invalid Access Token' });

    try {
        let customer = await User.findOne({ where: { user_id: customer_id, role_id: 2 } });
        if (customer == null) return res.status(400).send('This user does not exist');
    } catch (err) {
        console.log(err);
        return res.status(500).send('An error occurred while creating the order, please try again');
    }

    try {
        // Get all orders and sort by creation date
        let orderList = await Order.findAll({
            attributes: ['order_id', 'total_order_value', 'user_id'],
            include: [
                {
                    model: Order_Status_Change_History, where: { state_id: 1 }
                },
            ],
            where: { user_id: customer_id },
            order: [
                [Order_Status_Change_History, 'created_at', 'DESC']
            ]
        });

        orderList = await Promise.all(orderList.map(async (order) => {
            // Get the product list of the order
            let productVariantList = await order.getProduct_variants();
            let orderItemList = [];
            for (let productVariant of productVariantList) {
                let product = await productVariant.getProduct();
                let productImages = await productVariant.getProduct_Images();
                let colour = await productVariant.getColour();
                let size = await productVariant.getSize();

                let feedback = await Feedback.findOne({
                    where: {
                        user_id: customer_id,
                        product_variant_id: productVariant.product_variant_id
                    }
                });
                let hasFeedback = feedback != null;

                let productVariantConverted = {
                    product_variant_id: productVariant.product_variant_id,
                    name: product.product_name,
                    image: productImages[0].path,
                    quantity: productVariant.Order_Item.quantity,
                    colour: colour.colour_name,
                    size: size.size_name,
                    price: productVariant.Order_Item.price,
                    has_feedback: hasFeedback
                };
                orderItemList.push(productVariantConverted);
            }

            // Get the final status of the order
            let stateList = await order.getOrder_States();
            let state = stateList.pop();

            // Convert the order
            let orderConverted = {
                order_id: order.order_id,
                state_id: state.state_id,
                state_name: state.state_name,
                order_items: orderItemList,
                total_order_value: order.total_order_value,
                created_at: order.Order_Status_Change_Histories[0].created_at
            };
            return orderConverted;
        }));

        return res.send(orderList);
    } catch (err) {
        console.log(err);
        return res.status(500).send('An error occurred while loading data, please try again');
    }
}


let detailCustomerSide = async (req, res, next) => {
    let customer_id = req.token.customer_id;
    if (!customer_id) return res.status(400).send({ message: 'Invalid Access Token' });

    try {
        let customer = await User.findOne({ where: { user_id: customer_id, role_id: 2 } });
        if (customer == null) return res.status(400).send('This user does not exist');
    } catch (err) {
        console.log(err);
        return res.status(500).send('An error occurred while loading data, please try again');
    }

    let order_id = req.params.order_id;
    if (order_id === undefined) return res.status(400).send('The order_id field does not exist');
    let order;
    try {
        order = await Order.findOne({ where: { order_id, user_id: customer_id } });
        if (order == null) return res.status(400).send('This order does not exist');
    } catch (err) {
        console.log(err);
        return res.status(500).send('An error occurred while loading data, please try again');
    }

    let stateList = await order.getOrder_States();
    let created_at = stateList[0].Order_Status_Change_History.created_at;
    let state = stateList.pop();

    let productVariantList = await order.getProduct_variants();
    let orderItemList = [];
    for (let productVariant of productVariantList) {
        let product = await productVariant.getProduct();
        let colour = await productVariant.getColour();
        let size = await productVariant.getSize();
        let productVariantConverted = {
            name: product.product_name,
            quantity: productVariant.Order_Item.quantity,
            price: productVariant.Order_Item.price,
            colour: colour.colour_name,
            size: size.size_name,
            total_value: productVariant.Order_Item.total_value
        };
        orderItemList.push(productVariantConverted);
    }

    let orderConverted = {
        order_id: order.order_id,
        state_id: state.state_id,
        state_name: state.state_name,
        created_at,
        order_items: orderItemList,
        total_product_value: order.total_product_value,
        delivery_charges: order.delivery_charges,
        total_order_value: order.total_order_value,
        customer_name: order.customer_name,
        email: order.email,
        phone_number: order.phone_number,
        address: order.address
    };

    return res.send(orderConverted);
}

let detailAdminSide = async (req, res, next) => {
    let order_id = req.params.order_id;
    if (order_id === undefined) return res.status(400).send('The order_id field does not exist');

    try {
        let order = await Order.findOne({ where: { order_id } });
        if (order == null) return res.status(400).send('This order does not exist');

        let stateList = await order.getOrder_States();
        let orderHistories = stateList.map((state) => {
            return {
                state_name: state.state_name,
                created_at: state.Order_Status_Change_History.created_at
            };
        });
        let created_at = stateList[0].Order_Status_Change_History.created_at;
        let state = stateList.pop();

        let productVariantList = await order.getProduct_variants();
        let orderItemList = [];
        for (let productVariant of productVariantList) {
            let product = await productVariant.getProduct();
            let colour = await productVariant.getColour();
            let size = await productVariant.getSize();
            let productVariantConverted = {
                name: product.product_name,
                quantity: productVariant.Order_Item.quantity,
                price: productVariant.Order_Item.price,
                colour: colour.colour_name,
                size: size.size_name,
                total_value: productVariant.Order_Item.total_value
            };
            orderItemList.push(productVariantConverted);
        }

        let orderConverted = {
            order_id: order.order_id,
            state_id: state.state_id,
            state_name: state.state_name,
            created_at,
            order_items: orderItemList,
            total_product_value: order.total_product_value,
            delivery_charges: order.delivery_charges,
            total_order_value: order.total_order_value,
            order_histories: orderHistories,
            customer_name: order.customer_name,
            email: order.email,
            phone_number: order.phone_number,
            address: order.address
        };

        return res.send(orderConverted);
    } catch (err) {
        console.log(err);
        return res.status(500).send('An error occurred while loading data, please try again');
    }
}

let changeStatus = async (req, res, next) => {
    let order_id = req.params.order_id;
    if (order_id === undefined) return res.status(400).send('The order_id field does not exist');
    let state_id = req.params.state_id;
    if (state_id === undefined) return res.status(400).send('The state_id field does not exist');
    let order;
    try {
        order = await Order.findOne({ where: { order_id } });
        if (order == null) return res.status(400).send('This order does not exist');
    } catch (err) {
        console.log(err);
        return res.status(500).send('An error occurred while creating the order, please try again');
    }

    try {
        // Handle changing order status to "Confirmed"
        if (state_id == 2) {
            let stateList = await order.getOrder_Status_Change_Histories();
            const even = (state) => state.state_id == 1;
            // Check if the order has the status "Pending Confirmation"
            if (stateList.some(even)) {
                let state = await Order_State.findOne({ where: { state_id: 2 } });
                let newState = await order.addOrder_State(state);
                return res.send(newState);
            } else return res.send("Invalid order");
        }

        // Handle changing order status to "In Transit"
        if (state_id == 3) {
            let stateList = await order.getOrder_Status_Change_Histories();
            const even = (state) => state.state_id == 2;
            // Check if the order has the status "Confirmed"
            if (stateList.some(even)) {
                let state = await Order_State.findOne({ where: { state_id: 3 } });
                let newState = await order.addOrder_State(state);
                return res.send(newState);
            } else return res.send("Invalid order");
        }

        // Handle changing order status to "Delivered"
        if (state_id == 4) {
            let stateList = await order.getOrder_Status_Change_Histories();
            const even = (state) => state.state_id == 3;
            // Check if the order has the status "In Transit"
            if (stateList.some(even)) {
                let productVariantList = await order.getProduct_variants();
                for (let productVariant of productVariantList) {
                    let product = await productVariant.getProduct();
                    let oldSold = product.sold;
                    let quantity = productVariant.Order_Item.quantity;
                    let newSold = oldSold + quantity;
                    await product.update({ sold: newSold });
                }
                let state = await Order_State.findOne({ where: { state_id: 4 } });
                let newState = await order.addOrder_State(state);
                return res.send(newState);
            } else return res.send("Invalid order");
        }

        // Handle changing order status to "Canceled"
        if (state_id == 5) {
            let stateList = await order.getOrder_Status_Change_Histories();
            const even = (state) => state.state_id == 1;
            const lastIndex = stateList.length - 1;
            // Check if the order has the status "Pending Confirmation" and 
            // the last status is not "Delivered" or "Canceled by Shop"
            if (stateList.some(even) && stateList[lastIndex].state_id != 4 && stateList[lastIndex].state_id != 6) {
                let state = await Order_State.findOne({ where: { state_id: 5 } });
                let newState = await order.addOrder_State(state);
                return res.send(newState);
            } else return res.send("Invalid order");
        }

        // Handle changing order status to "Canceled by Shop"
        if (state_id == 6) {
            let stateList = await order.getOrder_Status_Change_Histories();
            const even = (state) => state.state_id == 1;
            const lastIndex = stateList.length - 1;
            // Check if the order has the status "Pending Confirmation" and 
            // the last status is not "Delivered" or "Canceled"
            if (stateList.some(even) && stateList[lastIndex].state_id != 4 && stateList[lastIndex].state_id != 5) {
                let state = await Order_State.findOne({ where: { state_id: 6 } });
                let newState = await order.addOrder_State(state);
                return res.send(newState);
            } else return res.send("Invalid order");
        }

        res.send("Invalid state_id");
    } catch (err) {
        console.log(err);
        return res.status(500).send('An error occurred while loading data, please try again');
    }
}


module.exports = {
    create,
    listAdminSide,
    listCustomerSide,
    detailCustomerSide,
    detailAdminSide,
    changeStatus
}
