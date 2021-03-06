var Client = require('node-rest-client').Client;
var client = new Client();

var emitter = require('../core-integration-server-v2/javascripts/emitter');;
var url, userName, password, token;
var errMsg = '"Connection timeout error" in Magento';
var page = 1, count = 0, finalDataArr = [];

function run(node) {
	try {
		var type = node.option.toLowerCase();
		var newUrl = url + "/index.php/rest/V1/integration/admin/token";
		var resObj = node.reqData;
		var args = {
			data : {
				username : userName,
				password : password
			},
			headers : {
				"Content-Type" : 'application/json'
			}
		};
		client.post(newUrl, args, function(data, res) {
			try {
				var status = parseInt(res.statusCode/100);
				if (status == 2) {
					token = data;
					getOrders(node);
				} else {
					if(status == 5) {
						emitter.emit('error', 'Server Error', data, '', node);
					} else {
						errMsg = data.message;
						if(errMsg.includes('%resources')) {
							errMsg.slice('%resources');
						}
						emitter.emit('error', errMsg, '', newUrl, node);
					}
				}
			} catch(e) {
				emitter.emit('error', e.message, e.stack, newUrl, node);
			}
		}).on('error', function(err) {
			emitter.emit('error', errMsg, '', newUrl, node);
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function getOrders(node) {
	try {
		var basicKey = token.replace("\"", "");
		var newUrl = url + "/index.php/rest/V1/orders?searchCriteria[pageSize]=10&searchCriteria[currentPage]=" + page;
		var args = {
			headers : {
				Authorization : "Bearer " + basicKey,
				Accept : "application/json"
			}
		};
		client.get(newUrl, args, function(data, res) {
			try {
				var status = parseInt(res.statusCode/100);
				if(status == 2) {
					count = data.total_count;
					setOrders(data.items, node);
				} else {
					if(status == 5) {
						emitter.emit('error', 'Server Error in Magento', data.toString(), newUrl, node);
					} else {
						errMsg = data.message;
						if(errMsg.includes('%resources')) {
							errMsg.slice('%resources');
						}
						emitter.emit('error', errMsg, data, newUrl, node);
					}
				}
			} catch(e) {
				emitter.emit('error', e.message, e.stack, newUrl, node);
			}
		}).on('error', function(err) {
			emitter.emit('error', errMsg, '', newUrl, node);
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function setOrders(ordersArr, node) {
	try {
		var resArr = [];
		var obj, resObj;
		var actionName = node.connection.actionName.toLowerCase();
		var msgPrefix = 'No ';
		if(node.optionType.toLowerCase() == 'new') {
			msgPrefix = 'No new ';
		}		
		var length = ordersArr.length;
		var pathStartTime = node.connection.startedAt;
		var arr = pathStartTime.split('/');
		var formattedDateStr = arr[1] + '/' + arr[0] + '/' + arr[2];
		var startDate = new Date(formattedDateStr);
		for(var i = 0; i < ordersArr.length; i++) {
			resObj = {};
			obj = ordersArr[i];
			if(node.optionType.toLowerCase() == 'new') {
				var cDate = new Date(obj.created_at);
				var cUTCDate = new Date(cDate);
				if(cUTCDate.getTime() < startDate.getTime()) {
					continue;
				}
			}
			resObj.id = obj.increment_id;
			resObj.email = obj.customer_email;
			resObj.price = obj.base_subtotal;
			resObj.quantity = obj.total_qty_ordered;
			resObj.shippingAmount = obj.base_shipping_amount;
			var objStatus = obj.status;
			if(objStatus.toLowerCase() == 'canceled') {
				objStatus = 'cancelled';
			}
			resObj.status = objStatus;
			resObj.name = obj.increment_id;
			resObj.createdAt = obj.created_at;
			resObj.updatedAt = obj.updated_at;
			var billingAddress = {};
			billingAddress.name = obj.billing_address.firstname + ' ' + obj.billing_address.lastname;
			billingAddress.firstName = obj.billing_address.firstname;
			billingAddress.lastName = obj.billing_address.lastname;
			billingAddress.company = obj.billing_address.company;
			billingAddress.street = obj.billing_address.street[0];
			billingAddress.city = obj.billing_address.city;
			billingAddress.country = obj.billing_address.country_id;
			billingAddress.zip = obj.billing_address.postcode;
			billingAddress.phone = obj.billing_address.telephone;
			billingAddress.state = obj.billing_address.region_code;
			billingAddress.countryCode = obj.billing_address.country_id;
			resObj.billingAddress = billingAddress;
			var shippingAddress = {};
			shippingAddress.name = obj.billing_address.firstname + ' ' + obj.billing_address.lastname;
			shippingAddress.firstName = obj.billing_address.firstname;
			shippingAddress.lastName = obj.billing_address.lastname;
			shippingAddress.company = obj.billing_address.company;
			shippingAddress.street = obj.billing_address.street[0];
			shippingAddress.city = obj.billing_address.city;
			shippingAddress.country = obj.billing_address.country_id;
			shippingAddress.zip = obj.billing_address.postcode;
			shippingAddress.phone = obj.billing_address.telephone;
			shippingAddress.state = obj.billing_address.region_code;
			shippingAddress.country = obj.billing_address.country_id;
			resObj.shippingAddress = shippingAddress;
			resObj.shippingMethod = obj.payment.method;
			resObj.paymentMethod = obj.payment.method;
			resObj.customerId = obj.customer_id;
			var itemArr = obj.items;
			var itemsArr = [];
			var itemObj, item;
			var quantity = 0;
			for(var j = 0; j < itemArr.length; j++) {
				item = {};
				itemObj = itemArr[j];
				item.id = itemObj.product_id;
				item.name = itemObj.name;
				item.price = itemObj.base_price;
				item.quantity = itemObj.qty_ordered;
				item.variant = itemObj.product_type;
				item.sku = itemObj.sku;
				itemsArr[j] = item;
			}
			resObj.items = itemsArr;
			resObj.isLast = false;
			resObj.slackFlag = false;
			var length = finalDataArr.length + i;
			if(length == count-1) {
				resObj.isLast = true;
				if(actionName == 'slack') {
					resObj.slackFlag = true;
				}
			}
			var l = resArr.length;
			resArr[l] = resObj;
		}
		if(resArr.length == 0) {
			emitter.emit("error", msgPrefix + 'orders found in Magento', "", "", node);
			return;
		}
		post(resArr, node, "");
		finalDataArr = finalDataArr.concat(resArr);
		if(finalDataArr.length != count) {
			page++;
			getOrders(node);
		}
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function post(response, node, message) {
	node.resData = response;
	emitter.emit('success', node, message);
}

function testApp(callback) {
	try {
		var newUrl = url + "/index.php/rest/V1/integration/admin/token";
		var args = {
			data : {
				username : userName,
				password : password
			},
			headers : {  
				"Content-Type" : 'application/json'
			}
		};
		var result;
		client.post(newUrl, args, function(data, res) {
			try {
				var status = parseInt(res.statusCode/100);
				if(status == 2) {
					result = {
						status : 'success',
						response : data
					};
				} else {
					result = {
						status : 'error',
						response : data
					};
				}
				callback(result);
			} catch(e) {
				callback({status : 'error', response : e.stack});
			}
		}).on('error', function(err) {
			callback({status:"error", response:err});
		});
	} catch(e) {
		callback({status:"error", response:e.stack});
	}
}

function test(request, callback) {
	try {
		var credentials = request.credentials;
		url = credentials.url;
		userName = credentials.userName;
		password = credentials.password;
		testApp(callback);
	} catch(e) {
		callback({status:'error', response:e.stack});
	}
}

function init(node) {
	try {
		var credentials = node.credentials;
		url = credentials.url;
		userName = credentials.userName;
		password = credentials.password;
		run(node);
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

var Magento = {
	init : init,
	test : test
};

module.exports = Magento;