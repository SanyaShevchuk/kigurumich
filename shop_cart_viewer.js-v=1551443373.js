(function ($, w, d) {
    "use strict";

    if (!w.formatMoney) {
        /**
         * Работает аналогично методу money класса \engine\Formatter
         *
         * @param {Number} val
         * @returns {String}
         */
        w.formatMoney = function (val) {
            if ('number' !== typeof val) {
                val = parseFloat(val);
            }
            var valFloat0 = Math.round(val);
            var res1 = val.toFixed(1);
            var res2 = val.toFixed(2);
            var valFloat1 = parseFloat(res1);
            var valFloat2 = parseFloat(res2);
            if (valFloat1 !== valFloat2) {
                return res2;
            }
            if (valFloat0 !== valFloat1) {
                return res1;
            }
            return valFloat0.toFixed(0);
        };
    }

    var CART_COOKIE_NAME = 'cart';
    var allCurrencies = [];
    var availablePayments = {
        ya_kassa: {
            initPayment: function (appInfo, payInfo) {
                if (1 == parseInt(payInfo.isPluggedAndConfigured) &&
                    1 == isChosenCurrencyMatch('ya_kassa')
                ) {
                    appInfo.userData.payWith = 'ya_kassa';
                    prepareFormFunction = function (data) {
                        //обработка платежа с помощью Яндекс.Кассы
                        if (data && data.confirmation_url) {
                            //переадрессация на страницу подтверждения платежа на стороне Яндекс.Кассы
                            window.location.href = data.confirmation_url;
                        } else {
                            //интеграция Яндекс.Кассы выключена или что-то пошло не так
                            console.log(data);
                            alert('Оплата недоступна! Более подробную информацию смотрите в консоли');
                        }
                    };
                    appInfo.$data.doPay = 1;
                }
            }
        },
        robokassa: {
            initPayment: function (appInfo, payInfo) {

                if (1 == parseInt(payInfo.isPluggedAndConfigured) &&
                    1 == isChosenCurrencyMatch('robokassa')
                ) {
                    appInfo.userData.payWith = 'robokassa';
                    prepareFormFunction = function (paymentData) {
                        var paymentForm = $(".robo-int__form");
                        for (var name in paymentData) {
                            paymentForm.find("input[name='" + name + "']").val(paymentData[name]);
                        }
                        paymentForm.submit();
                        paymentForm = null;
                    };
                    appInfo.$data.doPay = 1;
                }
            }
        }
    };

    var prepareFormFunction = function () {/* переопределяюсь  в объекте availablePayments */};

    var ShopCart = function () {
        this.isReady = false;
        this.apiURL = (window.lpmBaseUrl.indexOf('/admin/') > 0 ? '/admin/' : '/') + w.shopCartSiteID + '/cart/';
        this.wndSelector = '#shopCartModal';
        this.$wnd = null;
        this.info = {};
        this.products = [];
        this.$iconCart = $('#shop-cart-btn');
        this.formSelector = '#shop-cart-form';
        this.order = 0;
        this.isEmpty = true;
    };

    ShopCart.prototype.init = function () {
        var cart = this;

        /* TODO: удалить перед выкатом */
        Vue.config.devtools = true;

        cart.app = new Vue({
            el: cart.wndSelector,
            data: {
                info: cart.info,
                activeList: [],
                list: cart.products,
                isPC: adapterManager.isPC(),
                curSlide: 0,
                fields: [],
                delivery: {},
                userData: {},
                after: {},
                showConfirm: false,
                confirmProduct: {},
                message: 'Спасибо за заказ',
                redirectURL: '',
                doPay: 0
            },
            created: function () {
                var self = this;
                self.activeList = self.list.filter(function (elem) {
                    return elem.amount > 0;
                });

                self.fields = self.defineFields(self.info);
                self.delivery = self.defineDelivery(self.info);
                self.defineAfter(self.info);

                if (self.activeList.length) {
                    cart.$iconCart.show();
                }
            },
            methods: {
                add: function (productID) {
                    var self = this;
                    var product = self.activeList.find(function (elem) {
                        return elem.hasOwnProperty('id') && (elem.id == productID);
                    });

                    // Element already exists in shop cart
                    if ('undefined' !== typeof product) {
                        self.increaseAmount(product.id);
                        return product;
                    }

                    // Icon
                    cart.$iconCart.show();
                    cart.isCartEmpty = !this.activeList.length;

                    // New product
                    product = self.list.find(function (elem) {
                        return elem.hasOwnProperty('id') && (elem.id === productID);
                    });
                    self.activeList.push(product);
                    self.increaseAmount(product.id);
                },
                increaseAmount: function (productID) {
                    var self = this;
                    self.activeList = self.activeList.map(function (elem) {
                        if (elem.id === productID) {
                            elem.amount++;
                            self.updateProduct(elem);
                        }

                        return elem;
                    });
                },
                decreaseAmount: function (productID) {
                    var self = this;
                    self.activeList = self.activeList.map(function (elem) {
                        if (elem.id === productID) {
                            elem.amount--;
                            elem.amount = (elem.amount > 0) ? elem.amount : 1;
                            self.updateProduct(elem);
                        }

                        return elem;
                    });
                },
                defineFields: function (obj) {
                    var self = this;
                    var keys = [];

                    if (obj.hasOwnProperty('form_fields')) {
                        keys = Object.keys(obj.form_fields);

                        return keys
                            .filter(function (key) {
                                return (key !== 'delivery');
                            })
                            .map(function (key) {
                                var field = obj.form_fields[key];
                                field.key = key;
                                if (!field.hasOwnProperty('value')) {
                                    field.value = '';
                                }
                                self.userData[key] = field.value;

                                return field;
                            });
                    }

                    return {};
                },
                defineDelivery: function (obj) {
                    var self = this;
                    var delivery;

                    if (!obj.hasOwnProperty('form_fields')) {
                        return {};
                    }
                    delivery = obj.form_fields['delivery'];
                    delivery.key = 'delivery';
                    if (!delivery.hasOwnProperty('value')) {
                        delivery.value = 0;
                    }
                    self.userData.delivery = delivery.value;

                    return delivery;
                },
                defineAfter: function (info) {
                    var self = this
                        , afterConfirm;
                    if (!info.hasOwnProperty('afterConfirmAction')) {
                        return;
                    }

                    self.after = self.info.afterConfirmAction;

                    if (self.after.hasOwnProperty('message') && ('' !== self.after.message)) {
                        self.message = self.after.message;
                    }

                    if (self.after.hasOwnProperty('url') && ('' !== self.after.url)) {
                        self.redirectURL = self.after.url;
                    }

                    if (self.after.hasOwnProperty('pay')) {
                        //если выбран какой-либо тип оплаты
                        var chosenPayType = self.after.pay.chosenPayType;
                        if (chosenPayType && availablePayments.hasOwnProperty(chosenPayType)) {
                            availablePayments[chosenPayType].initPayment(self, self.after.pay[chosenPayType])
                        }
                    }

                },
                submitForm: function () {
                    var self = this;
                    self.userData.sendedFromPageId = w.siteId; // Определяем, с какой странички самбитится корзина
                    self.curSlide = 2;

                    $.post(cart.apiURL + 'order/act:submit/id:' + cart.order, self.userData, function (response) {
                        consoleDbg(response);
                        if (!self.doPay) {
                            //если НЕ совершается оплата, то только тогда чистим куку!!
                            setCookie(CART_COOKIE_NAME, 0, -1);
                        }
                        self.activeList = [];
                        cart.order = 0;
                        if (self.doPay && response.hasOwnProperty('paymentData')) {
                            prepareFormFunction(response.paymentData);
                        } else if ('' !== self.redirectURL) {
                            w.location.href = self.redirectURL;
                        }

                        self.list = self.clearAmount(self.list);
                        cart.$iconCart.hide();
                    }, 'json');

                },
                ask: function (index) {
                    this.showConfirm = true;
                    this.confirmProduct = this.activeList[index];
                    this.confirmProduct.index = index;
                },
                prevSlide: function () {
                    this.curSlide--;
                },
                nextSlide: function () {
                    if (!this.activeList.length) {
                        return;
                    }

                    this.curSlide++;
                    cart.focusFirstField();
                },
                closeModal: function () {
                    shopCart.$wnd.wind('hide');
                    this.curSlide = 0;
                },
                updateProduct: function (product) {
                    cart.sendRequest({
                        product: product.id,
                        amount: product.amount
                    });
                },
                cancel: function () {
                    this.showConfirm = false;
                    this.confirmProduct = {};
                },
                remove: function (index) {
                    this.showConfirm = false;
                    this.confirmProduct = {};
                    this.activeList[index].amount = 0;
                    cart.removeProduct(this.activeList[index].id);
                    this.activeList.splice(index, 1);

                    if (0 === this.activeList.length) {
                        cart.$iconCart.hide();
                    }
                },
                clearAmount: function (arr) {
                    return arr.map(function (elem) {
                        elem.amount = 0;

                        return elem;
                    });
                }
            },
            computed: {
                total: function () {
                    var sumFloat = this.activeList.reduce(function (total, curr) {
                        if (curr.hasOwnProperty('price') && curr.hasOwnProperty('amount')) {
                            return total + (curr.price * curr.amount);
                        }

                        return total;
                    }, 0);
                    return formatMoney(sumFloat);
                },
                amount: function () {
                    return this.activeList.reduce(function (total, curr) {
                        if (curr.hasOwnProperty('amount')) {
                            return total + parseInt(curr.amount, 10);
                        }

                        return total;
                    }, 0);
                }
            }
        });

        cart.icon = new Vue({
            el: '#shopCartAmount',
            data: {
                isBlock: false,
                isVisible: false
            },
            computed: {
                amount: function () {
                    return cart.app.amount;
                }
            }
        });

        cart.$wnd = $(cart.wndSelector);
        cart.ready = true;
    };

    ShopCart.prototype.animate = function (target) {
        var cart = this,
            $element,
            $fakeElement,
            $link,
            offsetElem,
            cartOffset = cart.$iconCart.offset(),
            $target = $(target),
            blk = $target.closest('.blk').attr('blk_class');

        switch (blk) {
            case 'blk_image_ext':
                // Для изображения используется собственная анимация
                if ($target.prop('tagName') == 'path') {
                    // Подразумевается, что используется библиотечная svg и пользователь нажал на какую-то конкретную часть
                    $target = $target.closest('svg');
                }
                $fakeElement = $target.clone();
                offsetElem = $target.offset();
                $fakeElement.css({
                    position: 'absolute',
                    top: offsetElem.top,
                    left: offsetElem.left,
                    zIndex: 1000
                });
                $('#shop-cart-animate-btn-wrap').append($fakeElement);
                $target.css({opacity: 0});

                var width = $target.width(),
                    height = $target.height();

                if ($target.prop("tagName") == 'svg') {
                    var color = $target.closest('.svg_container').css("color");
                    $fakeElement.css({
                        width: width,
                        height: height,
                        fill: function (i, val) {
                            if (color) {
                                return color;
                            } else {
                                return 'black';
                            }
                        }
                    })
                }

                $fakeElement.animate({
                    width: width / 2,
                    height: height / 2,
                    top: offsetElem.top + height / 4,
                    left: offsetElem.left + width / 4
                }, 250, function () {
                    $target.css({visibility: "visible"}).animate({opacity: 1}, 250);
                    $fakeElement.animate({
                        top: cartOffset.top,
                        left: cartOffset.left - 100
                    }, 500, function () {
                        $fakeElement.remove();

                        if (cart.isCartEmpty) {
                            cart.showHint();
                        }
                    });
                });

                break;
            case 'blk_button':
                $element = $target.closest('.blk_button_data_wrap');
                $fakeElement = $element.clone();
                $link = $element.children('a');
                offsetElem = $link.offset();
                var linkCSS = $link.css(['background', 'font-family', 'font-weight', 'font-style', 'font-size', 'padding', 'border', 'border-radius']);
                $fakeElement.css({
                    position: 'absolute',
                    top: offsetElem.top,
                    left: offsetElem.left,
                    zIndex: 1000
                }).find('a').css(linkCSS);
                $('#shop-cart-animate-btn-wrap').append($fakeElement);

                $fakeElement.animate({
                    top: cartOffset.top,
                    left: cartOffset.left - 100
                }, 500, function () {
                    $fakeElement.remove();

                    if (cart.isCartEmpty) {
                        cart.showHint();
                    }
                });
                break;
            default:
                consoleDbg('Данный вид блока не обрабатывается как товар');
                return;
        }
    };

    /**
     * @param productID
     */
    ShopCart.prototype.add = function (productID) {
        var cart = this;
        cart.app.add(productID);

        if (event.target) {
            cart.animate(event.target);
        }
    };

    /**
     * @param productID
     */
    ShopCart.prototype.removeProduct = function (productID) {
        var data = {
            order: this.order,
            product: productID
        };

        $.get(shopCart.apiURL + 'order/act:remove', data);
    };

    ShopCart.prototype.show = function () {
        this.$wnd.wind('show');
        this.app.curSlider = 0;
    };

    ShopCart.prototype.showHint = function () {
        var cart = this;
        cart.icon.isBlock = true;
        setTimeout(function () {
            cart.icon.isVisible = true;

            setTimeout(function () {
                cart.icon.isVisible = false;
                cart.icon.isBlock = false;
            }, 10000);
        }, 100)
    };

    /**
     * @param data
     */
    ShopCart.prototype.sendRequest = function (data) {
        var cart = this;
        var url = cart.apiURL + 'order/act:create';

        if (0 !== cart.order) {
            data.order = cart.order;
            url = cart.apiURL + 'order/act:update';
        }

        $.post(url, data, function (response) {
            if (response.hasOwnProperty('order')) {
                cart.order = parseInt(response.order, 10);
                setCookie(CART_COOKIE_NAME, cart.order, 30);
            }
        }, 'json');
    };

    ShopCart.prototype.focusFirstField = function () {
        // Иначе не работает (форма не успевает появиться)
        setTimeout(function () {
            $(this.formSelector).find('input:text:first').focus();
        }, 100);
    };


    function drawShopCartIcon() {
        shopCart.$iconCart
            .addClass(shopCart.info.btn.color)
            .addClass(shopCart.info.btn.type)
            .click(function () {
                shopCart.show()
            });
    }

    /**
     * set list of products
     * @param {Array} products
     */
    function setProductsList(products) {
        shopCart.products = products.map(function (elem) {
            elem.is_del = ('1' === elem.is_del);
            elem.amount = parseInt(elem.amount, 10);
            return elem;
        });

        w.shopCart.init();
    }

    /**
     * Preload list of products
     */
    function preloadProducts() {
        var url;
        var callback;
        var params = {};
        if (shopCart.order > 0) {
            url = shopCart.apiURL + 'product/act:by_order';
            params.order = shopCart.order;
            callback = function (response) {
                var answer = JSON.parse(response);
                if (isset(answer.error)) {
                    slackErrorDump(new Error(answer.error));
                }
                if (0 == answer.orderId) {
                    // чистим куку!!
                    setCookie(CART_COOKIE_NAME, 0, -1);
                }
                shopCart.order = parseInt(answer.orderId);
                setCookie(CART_COOKIE_NAME, shopCart.order, 30);
                setProductsList(answer.products);
            };
        } else {
            url = shopCart.apiURL + 'product';
            callback = function (response) {
                setProductsList(JSON.parse(response));
            };
        }
        $.get(url, params).then(callback);
    }

    function getAllCurrencies() {
        var url = shopCart.apiURL + 'currency';
        var success = function (response) {
            allCurrencies = JSON.parse(response);
        };

        $.get(url).then(success);
    }

    function getCurrencyDataByText(currencyText) {
        return allCurrencies.filter(function (currencyData) {
            return currencyData['text'] == currencyText
        })[0];
    }

    function isChosenCurrencyMatch(payType) {
        var currencyData = getCurrencyDataByText(shopCart.info.currency_short);
        if (currencyData.hasOwnProperty([payType])) {
            return currencyData[payType]; //1 or 0
        } else {
            throw new Error('Не опреденный тип оплаты "' + payType + '"')
        }
    }

    /**
     * Preload ShopCart main info
     */
    function preloadInfo() {
        var cartID = getCookie(CART_COOKIE_NAME);
        if (typeof cartID !== 'undefined' && cartID !== 0) {
            shopCart.order = parseInt(cartID);
        }

        $.get(shopCart.apiURL + 'settings', function (response) {
            shopCart.info = JSON.parse(response);
            drawShopCartIcon();
            getAllCurrencies();
            preloadProducts();
        });
    }

    w.shopCart = new ShopCart();
    $(d).ready(preloadInfo);
})(jQuery, window, document);