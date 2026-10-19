// Generated from agora-chat@1.4.0 (ISC) by scripts/generate-chat-codec.mjs. Do not edit.

import $protobuf from "protobufjs/minimal.js";

// Common aliases
const $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;
const $Object = $util.global.Object, $undefined = $util.global.undefined, $Error = $util.global.Error, $RangeError = $util.global.RangeError, $Array = $util.global.Array, $TypeError = $util.global.TypeError, $parseInt = $util.global.parseInt, $String = $util.global.String, $Number = $util.global.Number, $BigInt = $util.global.BigInt, $isFinite = $util.global.isFinite, $Boolean = $util.global.Boolean;

// Exported root namespace
const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

export const easemob = $root.easemob = (() => {

    const easemob = {};

    easemob.pb = (function() {

        const pb = {};

        pb.MessageBody = (function() {

            const MessageBody = function (properties) {
                this.contents = [];
                this.ext = [];
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            MessageBody.prototype.type = 0;

            MessageBody.prototype.from = null;

            MessageBody.prototype.to = null;

            MessageBody.prototype.contents = $util.emptyArray;

            MessageBody.prototype.ext = $util.emptyArray;

            MessageBody.prototype.ackMessageId = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

            MessageBody.prototype.msgConfig = null;

            MessageBody.prototype.ackContent = "";

            MessageBody.prototype.meta = "";

            MessageBody.prototype.editMessageId = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

            MessageBody.prototype.editScope = 1;

            MessageBody.create = function(properties) {
                return new MessageBody(properties);
            };

            MessageBody.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                if (message.type != null && $Object.hasOwnProperty.call(message, "type"))
                    writer.uint32(/* id 1, wireType 0 =*/8).int32(message.type);
                if (message.from != null && $Object.hasOwnProperty.call(message, "from"))
                    $root.easemob.pb.JID.encode(message.from, writer.uint32(/* id 2, wireType 2 =*/18).fork(), _depth + 1).ldelim();
                if (message.to != null && $Object.hasOwnProperty.call(message, "to"))
                    $root.easemob.pb.JID.encode(message.to, writer.uint32(/* id 3, wireType 2 =*/26).fork(), _depth + 1).ldelim();
                if (message.contents != null && message.contents.length)
                    for (let i = 0; i < message.contents.length; ++i)
                        $root.easemob.pb.MessageBody.Content.encode(message.contents[i], writer.uint32(/* id 4, wireType 2 =*/34).fork(), _depth + 1).ldelim();
                if (message.ext != null && message.ext.length)
                    for (let i = 0; i < message.ext.length; ++i)
                        $root.easemob.pb.KeyValue.encode(message.ext[i], writer.uint32(/* id 5, wireType 2 =*/42).fork(), _depth + 1).ldelim();
                if (message.ackMessageId != null && $Object.hasOwnProperty.call(message, "ackMessageId"))
                    writer.uint32(/* id 6, wireType 0 =*/48).uint64(message.ackMessageId);
                if (message.msgConfig != null && $Object.hasOwnProperty.call(message, "msgConfig"))
                    $root.easemob.pb.MessageBody.MessageConfig.encode(message.msgConfig, writer.uint32(/* id 7, wireType 2 =*/58).fork(), _depth + 1).ldelim();
                if (message.ackContent != null && $Object.hasOwnProperty.call(message, "ackContent"))
                    writer.uint32(/* id 8, wireType 2 =*/66).string(message.ackContent);
                if (message.meta != null && $Object.hasOwnProperty.call(message, "meta"))
                    writer.uint32(/* id 9, wireType 2 =*/74).string(message.meta);
                if (message.editMessageId != null && $Object.hasOwnProperty.call(message, "editMessageId"))
                    writer.uint32(/* id 11, wireType 0 =*/88).uint64(message.editMessageId);
                if (message.editScope != null && $Object.hasOwnProperty.call(message, "editScope"))
                    writer.uint32(/* id 12, wireType 0 =*/96).int32(message.editScope);
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            MessageBody.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            MessageBody.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end, message, value;
                if (length === $undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw $RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = _target || new $root.easemob.pb.MessageBody();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType !== 0)
                                break;
                            value = reader.int32();
                            if ($root.easemob.pb.MessageBody.Type[value] !== $undefined)
                                message.type = value;
                            else if (!reader.discardUnknown) {
                                $util.makeProp(message, "$unknowns", false);
                                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                            }
                            continue;
                        }
                    case 2: {
                            if (wireType !== 2)
                                break;
                            message.from = $root.easemob.pb.JID.decode(reader, reader.size(), $undefined, _depth + 1, message.from);
                            continue;
                        }
                    case 3: {
                            if (wireType !== 2)
                                break;
                            message.to = $root.easemob.pb.JID.decode(reader, reader.size(), $undefined, _depth + 1, message.to);
                            continue;
                        }
                    case 4: {
                            if (wireType !== 2)
                                break;
                            if (!(message.contents && message.contents.length))
                                message.contents = [];
                            message.contents.push($root.easemob.pb.MessageBody.Content.decode(reader, reader.size(), $undefined, _depth + 1));
                            continue;
                        }
                    case 5: {
                            if (wireType !== 2)
                                break;
                            if (!(message.ext && message.ext.length))
                                message.ext = [];
                            message.ext.push($root.easemob.pb.KeyValue.decode(reader, reader.size(), $undefined, _depth + 1));
                            continue;
                        }
                    case 6: {
                            if (wireType !== 0)
                                break;
                            message.ackMessageId = reader.uint64();
                            continue;
                        }
                    case 7: {
                            if (wireType !== 2)
                                break;
                            message.msgConfig = $root.easemob.pb.MessageBody.MessageConfig.decode(reader, reader.size(), $undefined, _depth + 1, message.msgConfig);
                            continue;
                        }
                    case 8: {
                            if (wireType !== 2)
                                break;
                            message.ackContent = reader.string();
                            continue;
                        }
                    case 9: {
                            if (wireType !== 2)
                                break;
                            message.meta = reader.string();
                            continue;
                        }
                    case 11: {
                            if (wireType !== 0)
                                break;
                            message.editMessageId = reader.uint64();
                            continue;
                        }
                    case 12: {
                            if (wireType !== 0)
                                break;
                            value = reader.int32();
                            if ($root.easemob.pb.MessageBody.EditScope[value] !== $undefined)
                                message.editScope = value;
                            else if (!reader.discardUnknown) {
                                $util.makeProp(message, "$unknowns", false);
                                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                            }
                            continue;
                        }
                    }
                    reader.skipType(wireType, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (length !== $undefined) {
                    if (reader.pos !== end)
                        throw $RangeError("index out of range");
                    reader.len = length;
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                return message;
            };

            MessageBody.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.size());
            };

            MessageBody.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                if (message.type != null && $Object.hasOwnProperty.call(message, "type"))
                    switch (message.type) {
                    default:
                        return "type: enum value expected";
                    case 0:
                    case 1:
                    case 2:
                    case 3:
                    case 4:
                    case 5:
                    case 6:
                    case 7:
                    case 8:
                        break;
                    }
                if (message.from != null && $Object.hasOwnProperty.call(message, "from")) {
                    let error = $root.easemob.pb.JID.verify(message.from, _depth + 1);
                    if (error)
                        return "from." + error;
                }
                if (message.to != null && $Object.hasOwnProperty.call(message, "to")) {
                    let error = $root.easemob.pb.JID.verify(message.to, _depth + 1);
                    if (error)
                        return "to." + error;
                }
                if (message.contents != null && $Object.hasOwnProperty.call(message, "contents")) {
                    if (!$Array.isArray(message.contents))
                        return "contents: array expected";
                    for (let i = 0; i < message.contents.length; ++i) {
                        let error = $root.easemob.pb.MessageBody.Content.verify(message.contents[i], _depth + 1);
                        if (error)
                            return "contents." + error;
                    }
                }
                if (message.ext != null && $Object.hasOwnProperty.call(message, "ext")) {
                    if (!$Array.isArray(message.ext))
                        return "ext: array expected";
                    for (let i = 0; i < message.ext.length; ++i) {
                        let error = $root.easemob.pb.KeyValue.verify(message.ext[i], _depth + 1);
                        if (error)
                            return "ext." + error;
                    }
                }
                if (message.ackMessageId != null && $Object.hasOwnProperty.call(message, "ackMessageId"))
                    if (!$util.isInteger(message.ackMessageId) && !(message.ackMessageId && $util.isInteger(message.ackMessageId.low) && $util.isInteger(message.ackMessageId.high)))
                        return "ackMessageId: integer|Long expected";
                if (message.msgConfig != null && $Object.hasOwnProperty.call(message, "msgConfig")) {
                    let error = $root.easemob.pb.MessageBody.MessageConfig.verify(message.msgConfig, _depth + 1);
                    if (error)
                        return "msgConfig." + error;
                }
                if (message.ackContent != null && $Object.hasOwnProperty.call(message, "ackContent"))
                    if (!$util.isString(message.ackContent))
                        return "ackContent: string expected";
                if (message.meta != null && $Object.hasOwnProperty.call(message, "meta"))
                    if (!$util.isString(message.meta))
                        return "meta: string expected";
                if (message.editMessageId != null && $Object.hasOwnProperty.call(message, "editMessageId"))
                    if (!$util.isInteger(message.editMessageId) && !(message.editMessageId && $util.isInteger(message.editMessageId.low) && $util.isInteger(message.editMessageId.high)))
                        return "editMessageId: integer|Long expected";
                if (message.editScope != null && $Object.hasOwnProperty.call(message, "editScope"))
                    switch (message.editScope) {
                    default:
                        return "editScope: enum value expected";
                    case 1:
                    case 2:
                        break;
                    }
                return null;
            };

            MessageBody.fromObject = function (object, _depth) {
                if (object instanceof $root.easemob.pb.MessageBody)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".easemob.pb.MessageBody: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let message = new $root.easemob.pb.MessageBody();
                switch (object.type) {
                case "NORMAL":
                case 0:
                    message.type = 0;
                    break;
                case "CHAT":
                case 1:
                    message.type = 1;
                    break;
                case "GROUPCHAT":
                case 2:
                    message.type = 2;
                    break;
                case "CHATROOM":
                case 3:
                    message.type = 3;
                    break;
                case "READ_ACK":
                case 4:
                    message.type = 4;
                    break;
                case "DELIVER_ACK":
                case 5:
                    message.type = 5;
                    break;
                case "RECALL":
                case 6:
                    message.type = 6;
                    break;
                case "CHANNEL_ACK":
                case 7:
                    message.type = 7;
                    break;
                case "EDIT":
                case 8:
                    message.type = 8;
                    break;
                default:
                }
                if (object.from != null) {
                    if (!$util.isObject(object.from))
                        throw $TypeError(".easemob.pb.MessageBody.from: object expected");
                    message.from = $root.easemob.pb.JID.fromObject(object.from, _depth + 1);
                }
                if (object.to != null) {
                    if (!$util.isObject(object.to))
                        throw $TypeError(".easemob.pb.MessageBody.to: object expected");
                    message.to = $root.easemob.pb.JID.fromObject(object.to, _depth + 1);
                }
                if (object.contents) {
                    if (!$Array.isArray(object.contents))
                        throw $TypeError(".easemob.pb.MessageBody.contents: array expected");
                    message.contents = $Array(object.contents.length);
                    for (let i = 0; i < object.contents.length; ++i) {
                        if (!$util.isObject(object.contents[i]))
                            throw $TypeError(".easemob.pb.MessageBody.contents: object expected");
                        message.contents[i] = $root.easemob.pb.MessageBody.Content.fromObject(object.contents[i], _depth + 1);
                    }
                }
                if (object.ext) {
                    if (!$Array.isArray(object.ext))
                        throw $TypeError(".easemob.pb.MessageBody.ext: array expected");
                    message.ext = $Array(object.ext.length);
                    for (let i = 0; i < object.ext.length; ++i) {
                        if (!$util.isObject(object.ext[i]))
                            throw $TypeError(".easemob.pb.MessageBody.ext: object expected");
                        message.ext[i] = $root.easemob.pb.KeyValue.fromObject(object.ext[i], _depth + 1);
                    }
                }
                if (object.ackMessageId != null)
                    if ($util.Long)
                        message.ackMessageId = $util.Long.fromValue(object.ackMessageId, true);
                    else if (typeof object.ackMessageId === "string")
                        message.ackMessageId = $parseInt(object.ackMessageId, 10);
                    else if (typeof object.ackMessageId === "number")
                        message.ackMessageId = object.ackMessageId;
                    else if (typeof object.ackMessageId === "object")
                        message.ackMessageId = new $util.LongBits(object.ackMessageId.low >>> 0, object.ackMessageId.high >>> 0).toNumber(true);
                if (object.msgConfig != null) {
                    if (!$util.isObject(object.msgConfig))
                        throw $TypeError(".easemob.pb.MessageBody.msgConfig: object expected");
                    message.msgConfig = $root.easemob.pb.MessageBody.MessageConfig.fromObject(object.msgConfig, _depth + 1);
                }
                if (object.ackContent != null)
                    message.ackContent = $String(object.ackContent);
                if (object.meta != null)
                    message.meta = $String(object.meta);
                if (object.editMessageId != null)
                    if ($util.Long)
                        message.editMessageId = $util.Long.fromValue(object.editMessageId, true);
                    else if (typeof object.editMessageId === "string")
                        message.editMessageId = $parseInt(object.editMessageId, 10);
                    else if (typeof object.editMessageId === "number")
                        message.editMessageId = object.editMessageId;
                    else if (typeof object.editMessageId === "object")
                        message.editMessageId = new $util.LongBits(object.editMessageId.low >>> 0, object.editMessageId.high >>> 0).toNumber(true);
                switch (object.editScope) {
                case "BODY":
                case 1:
                    message.editScope = 1;
                    break;
                case "BODY_AND_EXT":
                case 2:
                    message.editScope = 2;
                    break;
                default:
                }
                return message;
            };

            MessageBody.toObject = function (message, options, _depth) {
                if (!options)
                    options = {};
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let object = {};
                if (options.arrays || options.defaults) {
                    object.contents = [];
                    object.ext = [];
                }
                if (options.defaults) {
                    object.type = options.enums === $String ? "NORMAL" : 0;
                    object.from = null;
                    object.to = null;
                    if ($util.Long) {
                        let long = new $util.Long(0, 0, true);
                        object.ackMessageId = options.longs === $String ? long.toString() : options.longs === $Number ? long.toNumber() : typeof $BigInt !== "undefined" && options.longs === $BigInt ? long.toBigInt() : long;
                    } else
                        object.ackMessageId = options.longs === $String ? "0" : typeof $BigInt !== "undefined" && options.longs === $BigInt ? $BigInt("0") : 0;
                    object.msgConfig = null;
                    object.ackContent = "";
                    object.meta = "";
                    if ($util.Long) {
                        let long = new $util.Long(0, 0, true);
                        object.editMessageId = options.longs === $String ? long.toString() : options.longs === $Number ? long.toNumber() : typeof $BigInt !== "undefined" && options.longs === $BigInt ? long.toBigInt() : long;
                    } else
                        object.editMessageId = options.longs === $String ? "0" : typeof $BigInt !== "undefined" && options.longs === $BigInt ? $BigInt("0") : 0;
                    object.editScope = options.enums === $String ? "BODY" : 1;
                }
                if (message.type != null && $Object.hasOwnProperty.call(message, "type"))
                    object.type = options.enums === $String ? $root.easemob.pb.MessageBody.Type[message.type] === $undefined ? message.type : $root.easemob.pb.MessageBody.Type[message.type] : message.type;
                if (message.from != null && $Object.hasOwnProperty.call(message, "from"))
                    object.from = $root.easemob.pb.JID.toObject(message.from, options, _depth + 1);
                if (message.to != null && $Object.hasOwnProperty.call(message, "to"))
                    object.to = $root.easemob.pb.JID.toObject(message.to, options, _depth + 1);
                if (message.contents && message.contents.length) {
                    object.contents = $Array(message.contents.length);
                    for (let j = 0; j < message.contents.length; ++j)
                        object.contents[j] = $root.easemob.pb.MessageBody.Content.toObject(message.contents[j], options, _depth + 1);
                }
                if (message.ext && message.ext.length) {
                    object.ext = $Array(message.ext.length);
                    for (let j = 0; j < message.ext.length; ++j)
                        object.ext[j] = $root.easemob.pb.KeyValue.toObject(message.ext[j], options, _depth + 1);
                }
                if (message.ackMessageId != null && $Object.hasOwnProperty.call(message, "ackMessageId"))
                    if (typeof $BigInt !== "undefined" && options.longs === $BigInt)
                        object.ackMessageId = typeof message.ackMessageId === "number" ? $BigInt(message.ackMessageId) : $util.Long.fromBits(message.ackMessageId.low >>> 0, message.ackMessageId.high >>> 0, true).toBigInt();
                    else if (typeof message.ackMessageId === "number")
                        object.ackMessageId = options.longs === $String ? $String(message.ackMessageId) : message.ackMessageId;
                    else
                        object.ackMessageId = options.longs === $String ? $util.Long.prototype.toString.call(message.ackMessageId) : options.longs === $Number ? new $util.LongBits(message.ackMessageId.low >>> 0, message.ackMessageId.high >>> 0).toNumber(true) : message.ackMessageId;
                if (message.msgConfig != null && $Object.hasOwnProperty.call(message, "msgConfig"))
                    object.msgConfig = $root.easemob.pb.MessageBody.MessageConfig.toObject(message.msgConfig, options, _depth + 1);
                if (message.ackContent != null && $Object.hasOwnProperty.call(message, "ackContent"))
                    object.ackContent = message.ackContent;
                if (message.meta != null && $Object.hasOwnProperty.call(message, "meta"))
                    object.meta = message.meta;
                if (message.editMessageId != null && $Object.hasOwnProperty.call(message, "editMessageId"))
                    if (typeof $BigInt !== "undefined" && options.longs === $BigInt)
                        object.editMessageId = typeof message.editMessageId === "number" ? $BigInt(message.editMessageId) : $util.Long.fromBits(message.editMessageId.low >>> 0, message.editMessageId.high >>> 0, true).toBigInt();
                    else if (typeof message.editMessageId === "number")
                        object.editMessageId = options.longs === $String ? $String(message.editMessageId) : message.editMessageId;
                    else
                        object.editMessageId = options.longs === $String ? $util.Long.prototype.toString.call(message.editMessageId) : options.longs === $Number ? new $util.LongBits(message.editMessageId.low >>> 0, message.editMessageId.high >>> 0).toNumber(true) : message.editMessageId;
                if (message.editScope != null && $Object.hasOwnProperty.call(message, "editScope"))
                    object.editScope = options.enums === $String ? $root.easemob.pb.MessageBody.EditScope[message.editScope] === $undefined ? message.editScope : $root.easemob.pb.MessageBody.EditScope[message.editScope] : message.editScope;
                return object;
            };

            MessageBody.prototype.toJSON = function() {
                return MessageBody.toObject(this, $protobuf.util.toJSONOptions);
            };

            MessageBody.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/easemob.pb.MessageBody";
            };

            MessageBody.Content = (function() {

                const Content = function (properties) {
                    this.params = [];
                    this.customExts = [];
                    if (properties)
                        for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                            if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                this[keys[i]] = properties[keys[i]];
                };

                Content.prototype.type = 0;

                Content.prototype.text = "";

                Content.prototype.latitude = 0;

                Content.prototype.longitude = 0;

                Content.prototype.address = "";

                Content.prototype.displayName = "";

                Content.prototype.remotePath = "";

                Content.prototype.secretKey = "";

                Content.prototype.fileLength = 0;

                Content.prototype.action = "";

                Content.prototype.params = $util.emptyArray;

                Content.prototype.duration = 0;

                Content.prototype.size = null;

                Content.prototype.thumbnailRemotePath = "";

                Content.prototype.thumbnailSecretKey = "";

                Content.prototype.thumbnailDisplayName = "";

                Content.prototype.thumbnailFileLength = 0;

                Content.prototype.thumbnailSize = null;

                Content.prototype.customEvent = "";

                Content.prototype.customExts = $util.emptyArray;

                Content.prototype.buildingName = "";

                Content.prototype.subType = 0;

                Content.prototype.title = "";

                Content.prototype.summary = "";

                Content.prototype.combineLevel = 0;

                Content.create = function(properties) {
                    return new Content(properties);
                };

                Content.encode = function (message, writer, _depth) {
                    if (!writer)
                        writer = $Writer.create();
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $util.recursionLimit)
                        throw $Error("max depth exceeded");
                    if (message.type != null && $Object.hasOwnProperty.call(message, "type"))
                        writer.uint32(/* id 1, wireType 0 =*/8).int32(message.type);
                    if (message.text != null && $Object.hasOwnProperty.call(message, "text"))
                        writer.uint32(/* id 2, wireType 2 =*/18).string(message.text);
                    if (message.latitude != null && $Object.hasOwnProperty.call(message, "latitude"))
                        writer.uint32(/* id 3, wireType 1 =*/25).double(message.latitude);
                    if (message.longitude != null && $Object.hasOwnProperty.call(message, "longitude"))
                        writer.uint32(/* id 4, wireType 1 =*/33).double(message.longitude);
                    if (message.address != null && $Object.hasOwnProperty.call(message, "address"))
                        writer.uint32(/* id 5, wireType 2 =*/42).string(message.address);
                    if (message.displayName != null && $Object.hasOwnProperty.call(message, "displayName"))
                        writer.uint32(/* id 6, wireType 2 =*/50).string(message.displayName);
                    if (message.remotePath != null && $Object.hasOwnProperty.call(message, "remotePath"))
                        writer.uint32(/* id 7, wireType 2 =*/58).string(message.remotePath);
                    if (message.secretKey != null && $Object.hasOwnProperty.call(message, "secretKey"))
                        writer.uint32(/* id 8, wireType 2 =*/66).string(message.secretKey);
                    if (message.fileLength != null && $Object.hasOwnProperty.call(message, "fileLength"))
                        writer.uint32(/* id 9, wireType 0 =*/72).int32(message.fileLength);
                    if (message.action != null && $Object.hasOwnProperty.call(message, "action"))
                        writer.uint32(/* id 10, wireType 2 =*/82).string(message.action);
                    if (message.params != null && message.params.length)
                        for (let i = 0; i < message.params.length; ++i)
                            $root.easemob.pb.KeyValue.encode(message.params[i], writer.uint32(/* id 11, wireType 2 =*/90).fork(), _depth + 1).ldelim();
                    if (message.duration != null && $Object.hasOwnProperty.call(message, "duration"))
                        writer.uint32(/* id 12, wireType 0 =*/96).int32(message.duration);
                    if (message.size != null && $Object.hasOwnProperty.call(message, "size"))
                        $root.easemob.pb.MessageBody.Content.Size.encode(message.size, writer.uint32(/* id 13, wireType 2 =*/106).fork(), _depth + 1).ldelim();
                    if (message.thumbnailRemotePath != null && $Object.hasOwnProperty.call(message, "thumbnailRemotePath"))
                        writer.uint32(/* id 14, wireType 2 =*/114).string(message.thumbnailRemotePath);
                    if (message.thumbnailSecretKey != null && $Object.hasOwnProperty.call(message, "thumbnailSecretKey"))
                        writer.uint32(/* id 15, wireType 2 =*/122).string(message.thumbnailSecretKey);
                    if (message.thumbnailDisplayName != null && $Object.hasOwnProperty.call(message, "thumbnailDisplayName"))
                        writer.uint32(/* id 16, wireType 2 =*/130).string(message.thumbnailDisplayName);
                    if (message.thumbnailFileLength != null && $Object.hasOwnProperty.call(message, "thumbnailFileLength"))
                        writer.uint32(/* id 17, wireType 0 =*/136).int32(message.thumbnailFileLength);
                    if (message.thumbnailSize != null && $Object.hasOwnProperty.call(message, "thumbnailSize"))
                        $root.easemob.pb.MessageBody.Content.Size.encode(message.thumbnailSize, writer.uint32(/* id 18, wireType 2 =*/146).fork(), _depth + 1).ldelim();
                    if (message.customEvent != null && $Object.hasOwnProperty.call(message, "customEvent"))
                        writer.uint32(/* id 19, wireType 2 =*/154).string(message.customEvent);
                    if (message.customExts != null && message.customExts.length)
                        for (let i = 0; i < message.customExts.length; ++i)
                            $root.easemob.pb.KeyValue.encode(message.customExts[i], writer.uint32(/* id 20, wireType 2 =*/162).fork(), _depth + 1).ldelim();
                    if (message.buildingName != null && $Object.hasOwnProperty.call(message, "buildingName"))
                        writer.uint32(/* id 21, wireType 2 =*/170).string(message.buildingName);
                    if (message.subType != null && $Object.hasOwnProperty.call(message, "subType"))
                        writer.uint32(/* id 22, wireType 0 =*/176).int32(message.subType);
                    if (message.title != null && $Object.hasOwnProperty.call(message, "title"))
                        writer.uint32(/* id 23, wireType 2 =*/186).string(message.title);
                    if (message.summary != null && $Object.hasOwnProperty.call(message, "summary"))
                        writer.uint32(/* id 24, wireType 2 =*/194).string(message.summary);
                    if (message.combineLevel != null && $Object.hasOwnProperty.call(message, "combineLevel"))
                        writer.uint32(/* id 25, wireType 0 =*/200).int32(message.combineLevel);
                    if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                        for (let i = 0; i < message.$unknowns.length; ++i)
                            writer.raw(message.$unknowns[i]);
                    return writer;
                };

                Content.encodeDelimited = function(message, writer) {
                    return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
                };

                Content.decode = function (reader, length, _end, _depth, _target) {
                    if (!(reader instanceof $Reader))
                        reader = $Reader.create(reader);
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $Reader.recursionLimit)
                        throw $Error("max depth exceeded");
                    let end, message, value;
                    if (length === $undefined)
                        end = reader.len;
                    else {
                        end = reader.pos + length;
                        if (end > reader.len)
                            throw $RangeError("index out of range");
                        length = reader.len;
                        reader.len = end;
                    }
                    message = _target || new $root.easemob.pb.MessageBody.Content();
                    while (reader.pos < end) {
                        let start = reader.pos;
                        let tag = reader.tag();
                        if (tag === _end) {
                            _end = $undefined;
                            break;
                        }
                        let wireType = tag & 7;
                        switch (tag >>>= 3) {
                        case 1: {
                                if (wireType !== 0)
                                    break;
                                value = reader.int32();
                                if ($root.easemob.pb.MessageBody.Content.Type[value] !== $undefined)
                                    message.type = value;
                                else if (!reader.discardUnknown) {
                                    $util.makeProp(message, "$unknowns", false);
                                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                                }
                                continue;
                            }
                        case 2: {
                                if (wireType !== 2)
                                    break;
                                message.text = reader.string();
                                continue;
                            }
                        case 3: {
                                if (wireType !== 1)
                                    break;
                                message.latitude = reader.double();
                                continue;
                            }
                        case 4: {
                                if (wireType !== 1)
                                    break;
                                message.longitude = reader.double();
                                continue;
                            }
                        case 5: {
                                if (wireType !== 2)
                                    break;
                                message.address = reader.string();
                                continue;
                            }
                        case 6: {
                                if (wireType !== 2)
                                    break;
                                message.displayName = reader.string();
                                continue;
                            }
                        case 7: {
                                if (wireType !== 2)
                                    break;
                                message.remotePath = reader.string();
                                continue;
                            }
                        case 8: {
                                if (wireType !== 2)
                                    break;
                                message.secretKey = reader.string();
                                continue;
                            }
                        case 9: {
                                if (wireType !== 0)
                                    break;
                                message.fileLength = reader.int32();
                                continue;
                            }
                        case 10: {
                                if (wireType !== 2)
                                    break;
                                message.action = reader.string();
                                continue;
                            }
                        case 11: {
                                if (wireType !== 2)
                                    break;
                                if (!(message.params && message.params.length))
                                    message.params = [];
                                message.params.push($root.easemob.pb.KeyValue.decode(reader, reader.size(), $undefined, _depth + 1));
                                continue;
                            }
                        case 12: {
                                if (wireType !== 0)
                                    break;
                                message.duration = reader.int32();
                                continue;
                            }
                        case 13: {
                                if (wireType !== 2)
                                    break;
                                message.size = $root.easemob.pb.MessageBody.Content.Size.decode(reader, reader.size(), $undefined, _depth + 1, message.size);
                                continue;
                            }
                        case 14: {
                                if (wireType !== 2)
                                    break;
                                message.thumbnailRemotePath = reader.string();
                                continue;
                            }
                        case 15: {
                                if (wireType !== 2)
                                    break;
                                message.thumbnailSecretKey = reader.string();
                                continue;
                            }
                        case 16: {
                                if (wireType !== 2)
                                    break;
                                message.thumbnailDisplayName = reader.string();
                                continue;
                            }
                        case 17: {
                                if (wireType !== 0)
                                    break;
                                message.thumbnailFileLength = reader.int32();
                                continue;
                            }
                        case 18: {
                                if (wireType !== 2)
                                    break;
                                message.thumbnailSize = $root.easemob.pb.MessageBody.Content.Size.decode(reader, reader.size(), $undefined, _depth + 1, message.thumbnailSize);
                                continue;
                            }
                        case 19: {
                                if (wireType !== 2)
                                    break;
                                message.customEvent = reader.string();
                                continue;
                            }
                        case 20: {
                                if (wireType !== 2)
                                    break;
                                if (!(message.customExts && message.customExts.length))
                                    message.customExts = [];
                                message.customExts.push($root.easemob.pb.KeyValue.decode(reader, reader.size(), $undefined, _depth + 1));
                                continue;
                            }
                        case 21: {
                                if (wireType !== 2)
                                    break;
                                message.buildingName = reader.string();
                                continue;
                            }
                        case 22: {
                                if (wireType !== 0)
                                    break;
                                value = reader.int32();
                                if ($root.easemob.pb.MessageBody.Content.SubType[value] !== $undefined)
                                    message.subType = value;
                                else if (!reader.discardUnknown) {
                                    $util.makeProp(message, "$unknowns", false);
                                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                                }
                                continue;
                            }
                        case 23: {
                                if (wireType !== 2)
                                    break;
                                message.title = reader.string();
                                continue;
                            }
                        case 24: {
                                if (wireType !== 2)
                                    break;
                                message.summary = reader.string();
                                continue;
                            }
                        case 25: {
                                if (wireType !== 0)
                                    break;
                                message.combineLevel = reader.int32();
                                continue;
                            }
                        }
                        reader.skipType(wireType, _depth, tag);
                        if (!reader.discardUnknown) {
                            $util.makeProp(message, "$unknowns", false);
                            (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                        }
                    }
                    if (length !== $undefined) {
                        if (reader.pos !== end)
                            throw $RangeError("index out of range");
                        reader.len = length;
                    }
                    if (_end !== $undefined)
                        throw $Error("missing end group");
                    return message;
                };

                Content.decodeDelimited = function(reader) {
                    if (!(reader instanceof $Reader))
                        reader = new $Reader(reader);
                    return this.decode(reader, reader.size());
                };

                Content.verify = function (message, _depth) {
                    if (typeof message !== "object" || message === null)
                        return "object expected";
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $util.recursionLimit)
                        return "max depth exceeded";
                    if (message.type != null && $Object.hasOwnProperty.call(message, "type"))
                        switch (message.type) {
                        default:
                            return "type: enum value expected";
                        case 0:
                        case 1:
                        case 2:
                        case 3:
                        case 4:
                        case 5:
                        case 6:
                        case 7:
                        case 8:
                            break;
                        }
                    if (message.text != null && $Object.hasOwnProperty.call(message, "text"))
                        if (!$util.isString(message.text))
                            return "text: string expected";
                    if (message.latitude != null && $Object.hasOwnProperty.call(message, "latitude"))
                        if (typeof message.latitude !== "number")
                            return "latitude: number expected";
                    if (message.longitude != null && $Object.hasOwnProperty.call(message, "longitude"))
                        if (typeof message.longitude !== "number")
                            return "longitude: number expected";
                    if (message.address != null && $Object.hasOwnProperty.call(message, "address"))
                        if (!$util.isString(message.address))
                            return "address: string expected";
                    if (message.displayName != null && $Object.hasOwnProperty.call(message, "displayName"))
                        if (!$util.isString(message.displayName))
                            return "displayName: string expected";
                    if (message.remotePath != null && $Object.hasOwnProperty.call(message, "remotePath"))
                        if (!$util.isString(message.remotePath))
                            return "remotePath: string expected";
                    if (message.secretKey != null && $Object.hasOwnProperty.call(message, "secretKey"))
                        if (!$util.isString(message.secretKey))
                            return "secretKey: string expected";
                    if (message.fileLength != null && $Object.hasOwnProperty.call(message, "fileLength"))
                        if (!$util.isInteger(message.fileLength))
                            return "fileLength: integer expected";
                    if (message.action != null && $Object.hasOwnProperty.call(message, "action"))
                        if (!$util.isString(message.action))
                            return "action: string expected";
                    if (message.params != null && $Object.hasOwnProperty.call(message, "params")) {
                        if (!$Array.isArray(message.params))
                            return "params: array expected";
                        for (let i = 0; i < message.params.length; ++i) {
                            let error = $root.easemob.pb.KeyValue.verify(message.params[i], _depth + 1);
                            if (error)
                                return "params." + error;
                        }
                    }
                    if (message.duration != null && $Object.hasOwnProperty.call(message, "duration"))
                        if (!$util.isInteger(message.duration))
                            return "duration: integer expected";
                    if (message.size != null && $Object.hasOwnProperty.call(message, "size")) {
                        let error = $root.easemob.pb.MessageBody.Content.Size.verify(message.size, _depth + 1);
                        if (error)
                            return "size." + error;
                    }
                    if (message.thumbnailRemotePath != null && $Object.hasOwnProperty.call(message, "thumbnailRemotePath"))
                        if (!$util.isString(message.thumbnailRemotePath))
                            return "thumbnailRemotePath: string expected";
                    if (message.thumbnailSecretKey != null && $Object.hasOwnProperty.call(message, "thumbnailSecretKey"))
                        if (!$util.isString(message.thumbnailSecretKey))
                            return "thumbnailSecretKey: string expected";
                    if (message.thumbnailDisplayName != null && $Object.hasOwnProperty.call(message, "thumbnailDisplayName"))
                        if (!$util.isString(message.thumbnailDisplayName))
                            return "thumbnailDisplayName: string expected";
                    if (message.thumbnailFileLength != null && $Object.hasOwnProperty.call(message, "thumbnailFileLength"))
                        if (!$util.isInteger(message.thumbnailFileLength))
                            return "thumbnailFileLength: integer expected";
                    if (message.thumbnailSize != null && $Object.hasOwnProperty.call(message, "thumbnailSize")) {
                        let error = $root.easemob.pb.MessageBody.Content.Size.verify(message.thumbnailSize, _depth + 1);
                        if (error)
                            return "thumbnailSize." + error;
                    }
                    if (message.customEvent != null && $Object.hasOwnProperty.call(message, "customEvent"))
                        if (!$util.isString(message.customEvent))
                            return "customEvent: string expected";
                    if (message.customExts != null && $Object.hasOwnProperty.call(message, "customExts")) {
                        if (!$Array.isArray(message.customExts))
                            return "customExts: array expected";
                        for (let i = 0; i < message.customExts.length; ++i) {
                            let error = $root.easemob.pb.KeyValue.verify(message.customExts[i], _depth + 1);
                            if (error)
                                return "customExts." + error;
                        }
                    }
                    if (message.buildingName != null && $Object.hasOwnProperty.call(message, "buildingName"))
                        if (!$util.isString(message.buildingName))
                            return "buildingName: string expected";
                    if (message.subType != null && $Object.hasOwnProperty.call(message, "subType"))
                        switch (message.subType) {
                        default:
                            return "subType: enum value expected";
                        case 0:
                        case 1:
                            break;
                        }
                    if (message.title != null && $Object.hasOwnProperty.call(message, "title"))
                        if (!$util.isString(message.title))
                            return "title: string expected";
                    if (message.summary != null && $Object.hasOwnProperty.call(message, "summary"))
                        if (!$util.isString(message.summary))
                            return "summary: string expected";
                    if (message.combineLevel != null && $Object.hasOwnProperty.call(message, "combineLevel"))
                        if (!$util.isInteger(message.combineLevel))
                            return "combineLevel: integer expected";
                    return null;
                };

                Content.fromObject = function (object, _depth) {
                    if (object instanceof $root.easemob.pb.MessageBody.Content)
                        return object;
                    if (!$util.isObject(object))
                        throw $TypeError(".easemob.pb.MessageBody.Content: object expected");
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $util.recursionLimit)
                        throw $Error("max depth exceeded");
                    let message = new $root.easemob.pb.MessageBody.Content();
                    switch (object.type) {
                    case "TEXT":
                    case 0:
                        message.type = 0;
                        break;
                    case "IMAGE":
                    case 1:
                        message.type = 1;
                        break;
                    case "VIDEO":
                    case 2:
                        message.type = 2;
                        break;
                    case "LOCATION":
                    case 3:
                        message.type = 3;
                        break;
                    case "VOICE":
                    case 4:
                        message.type = 4;
                        break;
                    case "FILE":
                    case 5:
                        message.type = 5;
                        break;
                    case "COMMAND":
                    case 6:
                        message.type = 6;
                        break;
                    case "CUSTOM":
                    case 7:
                        message.type = 7;
                        break;
                    case "COMBINE":
                    case 8:
                        message.type = 8;
                        break;
                    default:
                    }
                    if (object.text != null)
                        message.text = $String(object.text);
                    if (object.latitude != null)
                        message.latitude = $Number(object.latitude);
                    if (object.longitude != null)
                        message.longitude = $Number(object.longitude);
                    if (object.address != null)
                        message.address = $String(object.address);
                    if (object.displayName != null)
                        message.displayName = $String(object.displayName);
                    if (object.remotePath != null)
                        message.remotePath = $String(object.remotePath);
                    if (object.secretKey != null)
                        message.secretKey = $String(object.secretKey);
                    if (object.fileLength != null)
                        message.fileLength = object.fileLength | 0;
                    if (object.action != null)
                        message.action = $String(object.action);
                    if (object.params) {
                        if (!$Array.isArray(object.params))
                            throw $TypeError(".easemob.pb.MessageBody.Content.params: array expected");
                        message.params = $Array(object.params.length);
                        for (let i = 0; i < object.params.length; ++i) {
                            if (!$util.isObject(object.params[i]))
                                throw $TypeError(".easemob.pb.MessageBody.Content.params: object expected");
                            message.params[i] = $root.easemob.pb.KeyValue.fromObject(object.params[i], _depth + 1);
                        }
                    }
                    if (object.duration != null)
                        message.duration = object.duration | 0;
                    if (object.size != null) {
                        if (!$util.isObject(object.size))
                            throw $TypeError(".easemob.pb.MessageBody.Content.size: object expected");
                        message.size = $root.easemob.pb.MessageBody.Content.Size.fromObject(object.size, _depth + 1);
                    }
                    if (object.thumbnailRemotePath != null)
                        message.thumbnailRemotePath = $String(object.thumbnailRemotePath);
                    if (object.thumbnailSecretKey != null)
                        message.thumbnailSecretKey = $String(object.thumbnailSecretKey);
                    if (object.thumbnailDisplayName != null)
                        message.thumbnailDisplayName = $String(object.thumbnailDisplayName);
                    if (object.thumbnailFileLength != null)
                        message.thumbnailFileLength = object.thumbnailFileLength | 0;
                    if (object.thumbnailSize != null) {
                        if (!$util.isObject(object.thumbnailSize))
                            throw $TypeError(".easemob.pb.MessageBody.Content.thumbnailSize: object expected");
                        message.thumbnailSize = $root.easemob.pb.MessageBody.Content.Size.fromObject(object.thumbnailSize, _depth + 1);
                    }
                    if (object.customEvent != null)
                        message.customEvent = $String(object.customEvent);
                    if (object.customExts) {
                        if (!$Array.isArray(object.customExts))
                            throw $TypeError(".easemob.pb.MessageBody.Content.customExts: array expected");
                        message.customExts = $Array(object.customExts.length);
                        for (let i = 0; i < object.customExts.length; ++i) {
                            if (!$util.isObject(object.customExts[i]))
                                throw $TypeError(".easemob.pb.MessageBody.Content.customExts: object expected");
                            message.customExts[i] = $root.easemob.pb.KeyValue.fromObject(object.customExts[i], _depth + 1);
                        }
                    }
                    if (object.buildingName != null)
                        message.buildingName = $String(object.buildingName);
                    switch (object.subType) {
                    case "COMBINE":
                    case 0:
                        message.subType = 0;
                        break;
                    case "GIF":
                    case 1:
                        message.subType = 1;
                        break;
                    default:
                    }
                    if (object.title != null)
                        message.title = $String(object.title);
                    if (object.summary != null)
                        message.summary = $String(object.summary);
                    if (object.combineLevel != null)
                        message.combineLevel = object.combineLevel | 0;
                    return message;
                };

                Content.toObject = function (message, options, _depth) {
                    if (!options)
                        options = {};
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $util.recursionLimit)
                        throw $Error("max depth exceeded");
                    let object = {};
                    if (options.arrays || options.defaults) {
                        object.params = [];
                        object.customExts = [];
                    }
                    if (options.defaults) {
                        object.type = options.enums === $String ? "TEXT" : 0;
                        object.text = "";
                        object.latitude = 0;
                        object.longitude = 0;
                        object.address = "";
                        object.displayName = "";
                        object.remotePath = "";
                        object.secretKey = "";
                        object.fileLength = 0;
                        object.action = "";
                        object.duration = 0;
                        object.size = null;
                        object.thumbnailRemotePath = "";
                        object.thumbnailSecretKey = "";
                        object.thumbnailDisplayName = "";
                        object.thumbnailFileLength = 0;
                        object.thumbnailSize = null;
                        object.customEvent = "";
                        object.buildingName = "";
                        object.subType = options.enums === $String ? "COMBINE" : 0;
                        object.title = "";
                        object.summary = "";
                        object.combineLevel = 0;
                    }
                    if (message.type != null && $Object.hasOwnProperty.call(message, "type"))
                        object.type = options.enums === $String ? $root.easemob.pb.MessageBody.Content.Type[message.type] === $undefined ? message.type : $root.easemob.pb.MessageBody.Content.Type[message.type] : message.type;
                    if (message.text != null && $Object.hasOwnProperty.call(message, "text"))
                        object.text = message.text;
                    if (message.latitude != null && $Object.hasOwnProperty.call(message, "latitude"))
                        object.latitude = options.json && !$isFinite(message.latitude) ? $String(message.latitude) : message.latitude;
                    if (message.longitude != null && $Object.hasOwnProperty.call(message, "longitude"))
                        object.longitude = options.json && !$isFinite(message.longitude) ? $String(message.longitude) : message.longitude;
                    if (message.address != null && $Object.hasOwnProperty.call(message, "address"))
                        object.address = message.address;
                    if (message.displayName != null && $Object.hasOwnProperty.call(message, "displayName"))
                        object.displayName = message.displayName;
                    if (message.remotePath != null && $Object.hasOwnProperty.call(message, "remotePath"))
                        object.remotePath = message.remotePath;
                    if (message.secretKey != null && $Object.hasOwnProperty.call(message, "secretKey"))
                        object.secretKey = message.secretKey;
                    if (message.fileLength != null && $Object.hasOwnProperty.call(message, "fileLength"))
                        object.fileLength = message.fileLength;
                    if (message.action != null && $Object.hasOwnProperty.call(message, "action"))
                        object.action = message.action;
                    if (message.params && message.params.length) {
                        object.params = $Array(message.params.length);
                        for (let j = 0; j < message.params.length; ++j)
                            object.params[j] = $root.easemob.pb.KeyValue.toObject(message.params[j], options, _depth + 1);
                    }
                    if (message.duration != null && $Object.hasOwnProperty.call(message, "duration"))
                        object.duration = message.duration;
                    if (message.size != null && $Object.hasOwnProperty.call(message, "size"))
                        object.size = $root.easemob.pb.MessageBody.Content.Size.toObject(message.size, options, _depth + 1);
                    if (message.thumbnailRemotePath != null && $Object.hasOwnProperty.call(message, "thumbnailRemotePath"))
                        object.thumbnailRemotePath = message.thumbnailRemotePath;
                    if (message.thumbnailSecretKey != null && $Object.hasOwnProperty.call(message, "thumbnailSecretKey"))
                        object.thumbnailSecretKey = message.thumbnailSecretKey;
                    if (message.thumbnailDisplayName != null && $Object.hasOwnProperty.call(message, "thumbnailDisplayName"))
                        object.thumbnailDisplayName = message.thumbnailDisplayName;
                    if (message.thumbnailFileLength != null && $Object.hasOwnProperty.call(message, "thumbnailFileLength"))
                        object.thumbnailFileLength = message.thumbnailFileLength;
                    if (message.thumbnailSize != null && $Object.hasOwnProperty.call(message, "thumbnailSize"))
                        object.thumbnailSize = $root.easemob.pb.MessageBody.Content.Size.toObject(message.thumbnailSize, options, _depth + 1);
                    if (message.customEvent != null && $Object.hasOwnProperty.call(message, "customEvent"))
                        object.customEvent = message.customEvent;
                    if (message.customExts && message.customExts.length) {
                        object.customExts = $Array(message.customExts.length);
                        for (let j = 0; j < message.customExts.length; ++j)
                            object.customExts[j] = $root.easemob.pb.KeyValue.toObject(message.customExts[j], options, _depth + 1);
                    }
                    if (message.buildingName != null && $Object.hasOwnProperty.call(message, "buildingName"))
                        object.buildingName = message.buildingName;
                    if (message.subType != null && $Object.hasOwnProperty.call(message, "subType"))
                        object.subType = options.enums === $String ? $root.easemob.pb.MessageBody.Content.SubType[message.subType] === $undefined ? message.subType : $root.easemob.pb.MessageBody.Content.SubType[message.subType] : message.subType;
                    if (message.title != null && $Object.hasOwnProperty.call(message, "title"))
                        object.title = message.title;
                    if (message.summary != null && $Object.hasOwnProperty.call(message, "summary"))
                        object.summary = message.summary;
                    if (message.combineLevel != null && $Object.hasOwnProperty.call(message, "combineLevel"))
                        object.combineLevel = message.combineLevel;
                    return object;
                };

                Content.prototype.toJSON = function() {
                    return Content.toObject(this, $protobuf.util.toJSONOptions);
                };

                Content.getTypeUrl = function(prefix) {
                    if (prefix === $undefined)
                        prefix = "type.googleapis.com";
                    return prefix + "/easemob.pb.MessageBody.Content";
                };

                Content.Type = (function() {
                    const valuesById = $Object.create(null), values = $Object.create(valuesById);
                    values[valuesById[0] = "TEXT"] = 0;
                    values[valuesById[1] = "IMAGE"] = 1;
                    values[valuesById[2] = "VIDEO"] = 2;
                    values[valuesById[3] = "LOCATION"] = 3;
                    values[valuesById[4] = "VOICE"] = 4;
                    values[valuesById[5] = "FILE"] = 5;
                    values[valuesById[6] = "COMMAND"] = 6;
                    values[valuesById[7] = "CUSTOM"] = 7;
                    values[valuesById[8] = "COMBINE"] = 8;
                    return values;
                })();

                Content.Size = (function() {

                    const Size = function (properties) {
                        if (properties)
                            for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                                if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                    this[keys[i]] = properties[keys[i]];
                    };

                    Size.prototype.width = 0;

                    Size.prototype.height = 0;

                    Size.create = function(properties) {
                        return new Size(properties);
                    };

                    Size.encode = function (message, writer, _depth) {
                        if (!writer)
                            writer = $Writer.create();
                        if (_depth === $undefined)
                            _depth = 0;
                        if (_depth > $util.recursionLimit)
                            throw $Error("max depth exceeded");
                        if (message.width != null && $Object.hasOwnProperty.call(message, "width"))
                            writer.uint32(/* id 1, wireType 1 =*/9).double(message.width);
                        if (message.height != null && $Object.hasOwnProperty.call(message, "height"))
                            writer.uint32(/* id 2, wireType 1 =*/17).double(message.height);
                        if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                            for (let i = 0; i < message.$unknowns.length; ++i)
                                writer.raw(message.$unknowns[i]);
                        return writer;
                    };

                    Size.encodeDelimited = function(message, writer) {
                        return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
                    };

                    Size.decode = function (reader, length, _end, _depth, _target) {
                        if (!(reader instanceof $Reader))
                            reader = $Reader.create(reader);
                        if (_depth === $undefined)
                            _depth = 0;
                        if (_depth > $Reader.recursionLimit)
                            throw $Error("max depth exceeded");
                        let end, message;
                        if (length === $undefined)
                            end = reader.len;
                        else {
                            end = reader.pos + length;
                            if (end > reader.len)
                                throw $RangeError("index out of range");
                            length = reader.len;
                            reader.len = end;
                        }
                        message = _target || new $root.easemob.pb.MessageBody.Content.Size();
                        while (reader.pos < end) {
                            let start = reader.pos;
                            let tag = reader.tag();
                            if (tag === _end) {
                                _end = $undefined;
                                break;
                            }
                            let wireType = tag & 7;
                            switch (tag >>>= 3) {
                            case 1: {
                                    if (wireType !== 1)
                                        break;
                                    message.width = reader.double();
                                    continue;
                                }
                            case 2: {
                                    if (wireType !== 1)
                                        break;
                                    message.height = reader.double();
                                    continue;
                                }
                            }
                            reader.skipType(wireType, _depth, tag);
                            if (!reader.discardUnknown) {
                                $util.makeProp(message, "$unknowns", false);
                                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                            }
                        }
                        if (length !== $undefined) {
                            if (reader.pos !== end)
                                throw $RangeError("index out of range");
                            reader.len = length;
                        }
                        if (_end !== $undefined)
                            throw $Error("missing end group");
                        return message;
                    };

                    Size.decodeDelimited = function(reader) {
                        if (!(reader instanceof $Reader))
                            reader = new $Reader(reader);
                        return this.decode(reader, reader.size());
                    };

                    Size.verify = function (message, _depth) {
                        if (typeof message !== "object" || message === null)
                            return "object expected";
                        if (_depth === $undefined)
                            _depth = 0;
                        if (_depth > $util.recursionLimit)
                            return "max depth exceeded";
                        if (message.width != null && $Object.hasOwnProperty.call(message, "width"))
                            if (typeof message.width !== "number")
                                return "width: number expected";
                        if (message.height != null && $Object.hasOwnProperty.call(message, "height"))
                            if (typeof message.height !== "number")
                                return "height: number expected";
                        return null;
                    };

                    Size.fromObject = function (object, _depth) {
                        if (object instanceof $root.easemob.pb.MessageBody.Content.Size)
                            return object;
                        if (!$util.isObject(object))
                            throw $TypeError(".easemob.pb.MessageBody.Content.Size: object expected");
                        if (_depth === $undefined)
                            _depth = 0;
                        if (_depth > $util.recursionLimit)
                            throw $Error("max depth exceeded");
                        let message = new $root.easemob.pb.MessageBody.Content.Size();
                        if (object.width != null)
                            message.width = $Number(object.width);
                        if (object.height != null)
                            message.height = $Number(object.height);
                        return message;
                    };

                    Size.toObject = function (message, options, _depth) {
                        if (!options)
                            options = {};
                        if (_depth === $undefined)
                            _depth = 0;
                        if (_depth > $util.recursionLimit)
                            throw $Error("max depth exceeded");
                        let object = {};
                        if (options.defaults) {
                            object.width = 0;
                            object.height = 0;
                        }
                        if (message.width != null && $Object.hasOwnProperty.call(message, "width"))
                            object.width = options.json && !$isFinite(message.width) ? $String(message.width) : message.width;
                        if (message.height != null && $Object.hasOwnProperty.call(message, "height"))
                            object.height = options.json && !$isFinite(message.height) ? $String(message.height) : message.height;
                        return object;
                    };

                    Size.prototype.toJSON = function() {
                        return Size.toObject(this, $protobuf.util.toJSONOptions);
                    };

                    Size.getTypeUrl = function(prefix) {
                        if (prefix === $undefined)
                            prefix = "type.googleapis.com";
                        return prefix + "/easemob.pb.MessageBody.Content.Size";
                    };

                    return Size;
                })();

                Content.SubType = (function() {
                    const valuesById = $Object.create(null), values = $Object.create(valuesById);
                    values[valuesById[0] = "COMBINE"] = 0;
                    values[valuesById[1] = "GIF"] = 1;
                    return values;
                })();

                return Content;
            })();

            MessageBody.Type = (function() {
                const valuesById = $Object.create(null), values = $Object.create(valuesById);
                values[valuesById[0] = "NORMAL"] = 0;
                values[valuesById[1] = "CHAT"] = 1;
                values[valuesById[2] = "GROUPCHAT"] = 2;
                values[valuesById[3] = "CHATROOM"] = 3;
                values[valuesById[4] = "READ_ACK"] = 4;
                values[valuesById[5] = "DELIVER_ACK"] = 5;
                values[valuesById[6] = "RECALL"] = 6;
                values[valuesById[7] = "CHANNEL_ACK"] = 7;
                values[valuesById[8] = "EDIT"] = 8;
                return values;
            })();

            MessageBody.EditScope = (function() {
                const valuesById = $Object.create(null), values = $Object.create(valuesById);
                values[valuesById[1] = "BODY"] = 1;
                values[valuesById[2] = "BODY_AND_EXT"] = 2;
                return values;
            })();

            MessageBody.MessageConfig = (function() {

                const MessageConfig = function (properties) {
                    if (properties)
                        for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                            if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                this[keys[i]] = properties[keys[i]];
                };

                MessageConfig.prototype.allowGroupAck = false;

                MessageConfig.create = function(properties) {
                    return new MessageConfig(properties);
                };

                MessageConfig.encode = function (message, writer, _depth) {
                    if (!writer)
                        writer = $Writer.create();
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $util.recursionLimit)
                        throw $Error("max depth exceeded");
                    if (message.allowGroupAck != null && $Object.hasOwnProperty.call(message, "allowGroupAck"))
                        writer.uint32(/* id 1, wireType 0 =*/8).bool(message.allowGroupAck);
                    if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                        for (let i = 0; i < message.$unknowns.length; ++i)
                            writer.raw(message.$unknowns[i]);
                    return writer;
                };

                MessageConfig.encodeDelimited = function(message, writer) {
                    return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
                };

                MessageConfig.decode = function (reader, length, _end, _depth, _target) {
                    if (!(reader instanceof $Reader))
                        reader = $Reader.create(reader);
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $Reader.recursionLimit)
                        throw $Error("max depth exceeded");
                    let end, message;
                    if (length === $undefined)
                        end = reader.len;
                    else {
                        end = reader.pos + length;
                        if (end > reader.len)
                            throw $RangeError("index out of range");
                        length = reader.len;
                        reader.len = end;
                    }
                    message = _target || new $root.easemob.pb.MessageBody.MessageConfig();
                    while (reader.pos < end) {
                        let start = reader.pos;
                        let tag = reader.tag();
                        if (tag === _end) {
                            _end = $undefined;
                            break;
                        }
                        let wireType = tag & 7;
                        switch (tag >>>= 3) {
                        case 1: {
                                if (wireType !== 0)
                                    break;
                                message.allowGroupAck = reader.bool();
                                continue;
                            }
                        }
                        reader.skipType(wireType, _depth, tag);
                        if (!reader.discardUnknown) {
                            $util.makeProp(message, "$unknowns", false);
                            (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                        }
                    }
                    if (length !== $undefined) {
                        if (reader.pos !== end)
                            throw $RangeError("index out of range");
                        reader.len = length;
                    }
                    if (_end !== $undefined)
                        throw $Error("missing end group");
                    return message;
                };

                MessageConfig.decodeDelimited = function(reader) {
                    if (!(reader instanceof $Reader))
                        reader = new $Reader(reader);
                    return this.decode(reader, reader.size());
                };

                MessageConfig.verify = function (message, _depth) {
                    if (typeof message !== "object" || message === null)
                        return "object expected";
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $util.recursionLimit)
                        return "max depth exceeded";
                    if (message.allowGroupAck != null && $Object.hasOwnProperty.call(message, "allowGroupAck"))
                        if (typeof message.allowGroupAck !== "boolean")
                            return "allowGroupAck: boolean expected";
                    return null;
                };

                MessageConfig.fromObject = function (object, _depth) {
                    if (object instanceof $root.easemob.pb.MessageBody.MessageConfig)
                        return object;
                    if (!$util.isObject(object))
                        throw $TypeError(".easemob.pb.MessageBody.MessageConfig: object expected");
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $util.recursionLimit)
                        throw $Error("max depth exceeded");
                    let message = new $root.easemob.pb.MessageBody.MessageConfig();
                    if (object.allowGroupAck != null)
                        message.allowGroupAck = $Boolean(object.allowGroupAck);
                    return message;
                };

                MessageConfig.toObject = function (message, options, _depth) {
                    if (!options)
                        options = {};
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $util.recursionLimit)
                        throw $Error("max depth exceeded");
                    let object = {};
                    if (options.defaults)
                        object.allowGroupAck = false;
                    if (message.allowGroupAck != null && $Object.hasOwnProperty.call(message, "allowGroupAck"))
                        object.allowGroupAck = message.allowGroupAck;
                    return object;
                };

                MessageConfig.prototype.toJSON = function() {
                    return MessageConfig.toObject(this, $protobuf.util.toJSONOptions);
                };

                MessageConfig.getTypeUrl = function(prefix) {
                    if (prefix === $undefined)
                        prefix = "type.googleapis.com";
                    return prefix + "/easemob.pb.MessageBody.MessageConfig";
                };

                return MessageConfig;
            })();

            return MessageBody;
        })();

        pb.KeyValue = (function() {

            const KeyValue = function (properties) {
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            KeyValue.prototype.key = "";

            KeyValue.prototype.type = 1;

            KeyValue.prototype.varintValue = null;

            KeyValue.prototype.floatValue = null;

            KeyValue.prototype.doubleValue = null;

            KeyValue.prototype.stringValue = null;

            // OneOf field names bound to virtual getters and setters
            let $oneOfFields;

            $Object.defineProperty(KeyValue.prototype, "value", {
                get: $util.oneOfGetter($oneOfFields = ["varintValue", "floatValue", "doubleValue", "stringValue"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            KeyValue.create = function(properties) {
                return new KeyValue(properties);
            };

            KeyValue.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                if (message.key != null && $Object.hasOwnProperty.call(message, "key"))
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.key);
                if (message.type != null && $Object.hasOwnProperty.call(message, "type"))
                    writer.uint32(/* id 2, wireType 0 =*/16).int32(message.type);
                if (message.varintValue != null && $Object.hasOwnProperty.call(message, "varintValue"))
                    writer.uint32(/* id 3, wireType 0 =*/24).int64(message.varintValue);
                if (message.floatValue != null && $Object.hasOwnProperty.call(message, "floatValue"))
                    writer.uint32(/* id 4, wireType 5 =*/37).float(message.floatValue);
                if (message.doubleValue != null && $Object.hasOwnProperty.call(message, "doubleValue"))
                    writer.uint32(/* id 5, wireType 1 =*/41).double(message.doubleValue);
                if (message.stringValue != null && $Object.hasOwnProperty.call(message, "stringValue"))
                    writer.uint32(/* id 6, wireType 2 =*/50).string(message.stringValue);
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            KeyValue.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            KeyValue.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end, message, value;
                if (length === $undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw $RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = _target || new $root.easemob.pb.KeyValue();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType !== 2)
                                break;
                            message.key = reader.string();
                            continue;
                        }
                    case 2: {
                            if (wireType !== 0)
                                break;
                            value = reader.int32();
                            if ($root.easemob.pb.KeyValue.ValueType[value] !== $undefined)
                                message.type = value;
                            else if (!reader.discardUnknown) {
                                $util.makeProp(message, "$unknowns", false);
                                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                            }
                            continue;
                        }
                    case 3: {
                            if (wireType !== 0)
                                break;
                            message.varintValue = reader.int64();
                            message.value = "varintValue";
                            continue;
                        }
                    case 4: {
                            if (wireType !== 5)
                                break;
                            message.floatValue = reader.float();
                            message.value = "floatValue";
                            continue;
                        }
                    case 5: {
                            if (wireType !== 1)
                                break;
                            message.doubleValue = reader.double();
                            message.value = "doubleValue";
                            continue;
                        }
                    case 6: {
                            if (wireType !== 2)
                                break;
                            message.stringValue = reader.string();
                            message.value = "stringValue";
                            continue;
                        }
                    }
                    reader.skipType(wireType, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (length !== $undefined) {
                    if (reader.pos !== end)
                        throw $RangeError("index out of range");
                    reader.len = length;
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                return message;
            };

            KeyValue.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.size());
            };

            KeyValue.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                let properties = {};
                if (message.key != null && $Object.hasOwnProperty.call(message, "key"))
                    if (!$util.isString(message.key))
                        return "key: string expected";
                if (message.type != null && $Object.hasOwnProperty.call(message, "type"))
                    switch (message.type) {
                    default:
                        return "type: enum value expected";
                    case 1:
                    case 2:
                    case 3:
                    case 4:
                    case 5:
                    case 6:
                    case 7:
                    case 8:
                        break;
                    }
                if (message.varintValue != null && $Object.hasOwnProperty.call(message, "varintValue")) {
                    properties.value = 1;
                    if (!$util.isInteger(message.varintValue) && !(message.varintValue && $util.isInteger(message.varintValue.low) && $util.isInteger(message.varintValue.high)))
                        return "varintValue: integer|Long expected";
                }
                if (message.floatValue != null && $Object.hasOwnProperty.call(message, "floatValue")) {
                    if (properties.value === 1)
                        return "value: multiple values";
                    properties.value = 1;
                    if (typeof message.floatValue !== "number")
                        return "floatValue: number expected";
                }
                if (message.doubleValue != null && $Object.hasOwnProperty.call(message, "doubleValue")) {
                    if (properties.value === 1)
                        return "value: multiple values";
                    properties.value = 1;
                    if (typeof message.doubleValue !== "number")
                        return "doubleValue: number expected";
                }
                if (message.stringValue != null && $Object.hasOwnProperty.call(message, "stringValue")) {
                    if (properties.value === 1)
                        return "value: multiple values";
                    properties.value = 1;
                    if (!$util.isString(message.stringValue))
                        return "stringValue: string expected";
                }
                return null;
            };

            KeyValue.fromObject = function (object, _depth) {
                if (object instanceof $root.easemob.pb.KeyValue)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".easemob.pb.KeyValue: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let message = new $root.easemob.pb.KeyValue();
                if (object.key != null)
                    message.key = $String(object.key);
                switch (object.type) {
                case "BOOL":
                case 1:
                    message.type = 1;
                    break;
                case "INT":
                case 2:
                    message.type = 2;
                    break;
                case "UINT":
                case 3:
                    message.type = 3;
                    break;
                case "LLINT":
                case 4:
                    message.type = 4;
                    break;
                case "FLOAT":
                case 5:
                    message.type = 5;
                    break;
                case "DOUBLE":
                case 6:
                    message.type = 6;
                    break;
                case "STRING":
                case 7:
                    message.type = 7;
                    break;
                case "JSON_STRING":
                case 8:
                    message.type = 8;
                    break;
                default:
                }
                if (object.varintValue != null)
                    if ($util.Long)
                        message.varintValue = $util.Long.fromValue(object.varintValue, false);
                    else if (typeof object.varintValue === "string")
                        message.varintValue = $parseInt(object.varintValue, 10);
                    else if (typeof object.varintValue === "number")
                        message.varintValue = object.varintValue;
                    else if (typeof object.varintValue === "object")
                        message.varintValue = new $util.LongBits(object.varintValue.low >>> 0, object.varintValue.high >>> 0).toNumber();
                if (object.floatValue != null)
                    message.floatValue = $Number(object.floatValue);
                if (object.doubleValue != null)
                    message.doubleValue = $Number(object.doubleValue);
                if (object.stringValue != null)
                    message.stringValue = $String(object.stringValue);
                return message;
            };

            KeyValue.toObject = function (message, options, _depth) {
                if (!options)
                    options = {};
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let object = {};
                if (options.defaults) {
                    object.key = "";
                    object.type = options.enums === $String ? "BOOL" : 1;
                }
                if (message.key != null && $Object.hasOwnProperty.call(message, "key"))
                    object.key = message.key;
                if (message.type != null && $Object.hasOwnProperty.call(message, "type"))
                    object.type = options.enums === $String ? $root.easemob.pb.KeyValue.ValueType[message.type] === $undefined ? message.type : $root.easemob.pb.KeyValue.ValueType[message.type] : message.type;
                if (message.varintValue != null && $Object.hasOwnProperty.call(message, "varintValue")) {
                    if (typeof $BigInt !== "undefined" && options.longs === $BigInt)
                        object.varintValue = typeof message.varintValue === "number" ? $BigInt(message.varintValue) : $util.Long.fromBits(message.varintValue.low >>> 0, message.varintValue.high >>> 0, false).toBigInt();
                    else if (typeof message.varintValue === "number")
                        object.varintValue = options.longs === $String ? $String(message.varintValue) : message.varintValue;
                    else
                        object.varintValue = options.longs === $String ? $util.Long.prototype.toString.call(message.varintValue) : options.longs === $Number ? new $util.LongBits(message.varintValue.low >>> 0, message.varintValue.high >>> 0).toNumber() : message.varintValue;
                    if (options.oneofs)
                        object.value = "varintValue";
                }
                if (message.floatValue != null && $Object.hasOwnProperty.call(message, "floatValue")) {
                    object.floatValue = options.json && !$isFinite(message.floatValue) ? $String(message.floatValue) : message.floatValue;
                    if (options.oneofs)
                        object.value = "floatValue";
                }
                if (message.doubleValue != null && $Object.hasOwnProperty.call(message, "doubleValue")) {
                    object.doubleValue = options.json && !$isFinite(message.doubleValue) ? $String(message.doubleValue) : message.doubleValue;
                    if (options.oneofs)
                        object.value = "doubleValue";
                }
                if (message.stringValue != null && $Object.hasOwnProperty.call(message, "stringValue")) {
                    object.stringValue = message.stringValue;
                    if (options.oneofs)
                        object.value = "stringValue";
                }
                return object;
            };

            KeyValue.prototype.toJSON = function() {
                return KeyValue.toObject(this, $protobuf.util.toJSONOptions);
            };

            KeyValue.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/easemob.pb.KeyValue";
            };

            KeyValue.ValueType = (function() {
                const valuesById = $Object.create(null), values = $Object.create(valuesById);
                values[valuesById[1] = "BOOL"] = 1;
                values[valuesById[2] = "INT"] = 2;
                values[valuesById[3] = "UINT"] = 3;
                values[valuesById[4] = "LLINT"] = 4;
                values[valuesById[5] = "FLOAT"] = 5;
                values[valuesById[6] = "DOUBLE"] = 6;
                values[valuesById[7] = "STRING"] = 7;
                values[valuesById[8] = "JSON_STRING"] = 8;
                return values;
            })();

            return KeyValue;
        })();

        pb.JID = (function() {

            const JID = function (properties) {
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            JID.prototype.appKey = "";

            JID.prototype.name = "";

            JID.prototype.domain = "";

            JID.prototype.clientResource = "";

            JID.create = function(properties) {
                return new JID(properties);
            };

            JID.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                if (message.appKey != null && $Object.hasOwnProperty.call(message, "appKey"))
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.appKey);
                if (message.name != null && $Object.hasOwnProperty.call(message, "name"))
                    writer.uint32(/* id 2, wireType 2 =*/18).string(message.name);
                if (message.domain != null && $Object.hasOwnProperty.call(message, "domain"))
                    writer.uint32(/* id 3, wireType 2 =*/26).string(message.domain);
                if (message.clientResource != null && $Object.hasOwnProperty.call(message, "clientResource"))
                    writer.uint32(/* id 4, wireType 2 =*/34).string(message.clientResource);
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            JID.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            JID.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end, message;
                if (length === $undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw $RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = _target || new $root.easemob.pb.JID();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType !== 2)
                                break;
                            message.appKey = reader.string();
                            continue;
                        }
                    case 2: {
                            if (wireType !== 2)
                                break;
                            message.name = reader.string();
                            continue;
                        }
                    case 3: {
                            if (wireType !== 2)
                                break;
                            message.domain = reader.string();
                            continue;
                        }
                    case 4: {
                            if (wireType !== 2)
                                break;
                            message.clientResource = reader.string();
                            continue;
                        }
                    }
                    reader.skipType(wireType, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (length !== $undefined) {
                    if (reader.pos !== end)
                        throw $RangeError("index out of range");
                    reader.len = length;
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                return message;
            };

            JID.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.size());
            };

            JID.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                if (message.appKey != null && $Object.hasOwnProperty.call(message, "appKey"))
                    if (!$util.isString(message.appKey))
                        return "appKey: string expected";
                if (message.name != null && $Object.hasOwnProperty.call(message, "name"))
                    if (!$util.isString(message.name))
                        return "name: string expected";
                if (message.domain != null && $Object.hasOwnProperty.call(message, "domain"))
                    if (!$util.isString(message.domain))
                        return "domain: string expected";
                if (message.clientResource != null && $Object.hasOwnProperty.call(message, "clientResource"))
                    if (!$util.isString(message.clientResource))
                        return "clientResource: string expected";
                return null;
            };

            JID.fromObject = function (object, _depth) {
                if (object instanceof $root.easemob.pb.JID)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".easemob.pb.JID: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let message = new $root.easemob.pb.JID();
                if (object.appKey != null)
                    message.appKey = $String(object.appKey);
                if (object.name != null)
                    message.name = $String(object.name);
                if (object.domain != null)
                    message.domain = $String(object.domain);
                if (object.clientResource != null)
                    message.clientResource = $String(object.clientResource);
                return message;
            };

            JID.toObject = function (message, options, _depth) {
                if (!options)
                    options = {};
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let object = {};
                if (options.defaults) {
                    object.appKey = "";
                    object.name = "";
                    object.domain = "";
                    object.clientResource = "";
                }
                if (message.appKey != null && $Object.hasOwnProperty.call(message, "appKey"))
                    object.appKey = message.appKey;
                if (message.name != null && $Object.hasOwnProperty.call(message, "name"))
                    object.name = message.name;
                if (message.domain != null && $Object.hasOwnProperty.call(message, "domain"))
                    object.domain = message.domain;
                if (message.clientResource != null && $Object.hasOwnProperty.call(message, "clientResource"))
                    object.clientResource = message.clientResource;
                return object;
            };

            JID.prototype.toJSON = function() {
                return JID.toObject(this, $protobuf.util.toJSONOptions);
            };

            JID.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/easemob.pb.JID";
            };

            return JID;
        })();

        pb.ConferenceBody = (function() {

            const ConferenceBody = function (properties) {
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            ConferenceBody.prototype.sessionId = "";

            ConferenceBody.prototype.operation = 0;

            ConferenceBody.prototype.conferenceId = "";

            ConferenceBody.prototype.type = 0;

            ConferenceBody.prototype.content = "";

            ConferenceBody.prototype.network = "";

            ConferenceBody.prototype.version = "";

            ConferenceBody.prototype.identity = 0;

            ConferenceBody.prototype.duration = "";

            ConferenceBody.prototype.peerName = "";

            ConferenceBody.prototype.endReason = 0;

            ConferenceBody.prototype.status = null;

            ConferenceBody.prototype.isDirect = false;

            ConferenceBody.prototype.controlType = 0;

            ConferenceBody.prototype.routeFlag = 0;

            ConferenceBody.prototype.routeKey = "";

            ConferenceBody.create = function(properties) {
                return new ConferenceBody(properties);
            };

            ConferenceBody.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                if (message.sessionId != null && $Object.hasOwnProperty.call(message, "sessionId"))
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.sessionId);
                if (message.operation != null && $Object.hasOwnProperty.call(message, "operation"))
                    writer.uint32(/* id 2, wireType 0 =*/16).int32(message.operation);
                if (message.conferenceId != null && $Object.hasOwnProperty.call(message, "conferenceId"))
                    writer.uint32(/* id 3, wireType 2 =*/26).string(message.conferenceId);
                if (message.type != null && $Object.hasOwnProperty.call(message, "type"))
                    writer.uint32(/* id 4, wireType 0 =*/32).int32(message.type);
                if (message.content != null && $Object.hasOwnProperty.call(message, "content"))
                    writer.uint32(/* id 5, wireType 2 =*/42).string(message.content);
                if (message.network != null && $Object.hasOwnProperty.call(message, "network"))
                    writer.uint32(/* id 6, wireType 2 =*/50).string(message.network);
                if (message.version != null && $Object.hasOwnProperty.call(message, "version"))
                    writer.uint32(/* id 7, wireType 2 =*/58).string(message.version);
                if (message.identity != null && $Object.hasOwnProperty.call(message, "identity"))
                    writer.uint32(/* id 8, wireType 0 =*/64).int32(message.identity);
                if (message.duration != null && $Object.hasOwnProperty.call(message, "duration"))
                    writer.uint32(/* id 9, wireType 2 =*/74).string(message.duration);
                if (message.peerName != null && $Object.hasOwnProperty.call(message, "peerName"))
                    writer.uint32(/* id 10, wireType 2 =*/82).string(message.peerName);
                if (message.endReason != null && $Object.hasOwnProperty.call(message, "endReason"))
                    writer.uint32(/* id 11, wireType 0 =*/88).int32(message.endReason);
                if (message.status != null && $Object.hasOwnProperty.call(message, "status"))
                    $root.easemob.pb.ConferenceBody.Status.encode(message.status, writer.uint32(/* id 12, wireType 2 =*/98).fork(), _depth + 1).ldelim();
                if (message.isDirect != null && $Object.hasOwnProperty.call(message, "isDirect"))
                    writer.uint32(/* id 13, wireType 0 =*/104).bool(message.isDirect);
                if (message.controlType != null && $Object.hasOwnProperty.call(message, "controlType"))
                    writer.uint32(/* id 14, wireType 0 =*/112).int32(message.controlType);
                if (message.routeFlag != null && $Object.hasOwnProperty.call(message, "routeFlag"))
                    writer.uint32(/* id 15, wireType 0 =*/120).int32(message.routeFlag);
                if (message.routeKey != null && $Object.hasOwnProperty.call(message, "routeKey"))
                    writer.uint32(/* id 16, wireType 2 =*/130).string(message.routeKey);
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            ConferenceBody.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            ConferenceBody.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end, message, value;
                if (length === $undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw $RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = _target || new $root.easemob.pb.ConferenceBody();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType !== 2)
                                break;
                            message.sessionId = reader.string();
                            continue;
                        }
                    case 2: {
                            if (wireType !== 0)
                                break;
                            value = reader.int32();
                            if ($root.easemob.pb.ConferenceBody.Operation[value] !== $undefined)
                                message.operation = value;
                            else if (!reader.discardUnknown) {
                                $util.makeProp(message, "$unknowns", false);
                                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                            }
                            continue;
                        }
                    case 3: {
                            if (wireType !== 2)
                                break;
                            message.conferenceId = reader.string();
                            continue;
                        }
                    case 4: {
                            if (wireType !== 0)
                                break;
                            value = reader.int32();
                            if ($root.easemob.pb.ConferenceBody.Type[value] !== $undefined)
                                message.type = value;
                            else if (!reader.discardUnknown) {
                                $util.makeProp(message, "$unknowns", false);
                                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                            }
                            continue;
                        }
                    case 5: {
                            if (wireType !== 2)
                                break;
                            message.content = reader.string();
                            continue;
                        }
                    case 6: {
                            if (wireType !== 2)
                                break;
                            message.network = reader.string();
                            continue;
                        }
                    case 7: {
                            if (wireType !== 2)
                                break;
                            message.version = reader.string();
                            continue;
                        }
                    case 8: {
                            if (wireType !== 0)
                                break;
                            value = reader.int32();
                            if ($root.easemob.pb.ConferenceBody.Identity[value] !== $undefined)
                                message.identity = value;
                            else if (!reader.discardUnknown) {
                                $util.makeProp(message, "$unknowns", false);
                                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                            }
                            continue;
                        }
                    case 9: {
                            if (wireType !== 2)
                                break;
                            message.duration = reader.string();
                            continue;
                        }
                    case 10: {
                            if (wireType !== 2)
                                break;
                            message.peerName = reader.string();
                            continue;
                        }
                    case 11: {
                            if (wireType !== 0)
                                break;
                            value = reader.int32();
                            if ($root.easemob.pb.ConferenceBody.EndReason[value] !== $undefined)
                                message.endReason = value;
                            else if (!reader.discardUnknown) {
                                $util.makeProp(message, "$unknowns", false);
                                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                            }
                            continue;
                        }
                    case 12: {
                            if (wireType !== 2)
                                break;
                            message.status = $root.easemob.pb.ConferenceBody.Status.decode(reader, reader.size(), $undefined, _depth + 1, message.status);
                            continue;
                        }
                    case 13: {
                            if (wireType !== 0)
                                break;
                            message.isDirect = reader.bool();
                            continue;
                        }
                    case 14: {
                            if (wireType !== 0)
                                break;
                            value = reader.int32();
                            if ($root.easemob.pb.ConferenceBody.StreamControlType[value] !== $undefined)
                                message.controlType = value;
                            else if (!reader.discardUnknown) {
                                $util.makeProp(message, "$unknowns", false);
                                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                            }
                            continue;
                        }
                    case 15: {
                            if (wireType !== 0)
                                break;
                            message.routeFlag = reader.int32();
                            continue;
                        }
                    case 16: {
                            if (wireType !== 2)
                                break;
                            message.routeKey = reader.string();
                            continue;
                        }
                    }
                    reader.skipType(wireType, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (length !== $undefined) {
                    if (reader.pos !== end)
                        throw $RangeError("index out of range");
                    reader.len = length;
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                return message;
            };

            ConferenceBody.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.size());
            };

            ConferenceBody.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                if (message.sessionId != null && $Object.hasOwnProperty.call(message, "sessionId"))
                    if (!$util.isString(message.sessionId))
                        return "sessionId: string expected";
                if (message.operation != null && $Object.hasOwnProperty.call(message, "operation"))
                    switch (message.operation) {
                    default:
                        return "operation: enum value expected";
                    case 0:
                    case 1:
                    case 2:
                    case 3:
                    case 4:
                    case 5:
                    case 6:
                    case 7:
                        break;
                    }
                if (message.conferenceId != null && $Object.hasOwnProperty.call(message, "conferenceId"))
                    if (!$util.isString(message.conferenceId))
                        return "conferenceId: string expected";
                if (message.type != null && $Object.hasOwnProperty.call(message, "type"))
                    switch (message.type) {
                    default:
                        return "type: enum value expected";
                    case 0:
                    case 1:
                        break;
                    }
                if (message.content != null && $Object.hasOwnProperty.call(message, "content"))
                    if (!$util.isString(message.content))
                        return "content: string expected";
                if (message.network != null && $Object.hasOwnProperty.call(message, "network"))
                    if (!$util.isString(message.network))
                        return "network: string expected";
                if (message.version != null && $Object.hasOwnProperty.call(message, "version"))
                    if (!$util.isString(message.version))
                        return "version: string expected";
                if (message.identity != null && $Object.hasOwnProperty.call(message, "identity"))
                    switch (message.identity) {
                    default:
                        return "identity: enum value expected";
                    case 0:
                    case 1:
                        break;
                    }
                if (message.duration != null && $Object.hasOwnProperty.call(message, "duration"))
                    if (!$util.isString(message.duration))
                        return "duration: string expected";
                if (message.peerName != null && $Object.hasOwnProperty.call(message, "peerName"))
                    if (!$util.isString(message.peerName))
                        return "peerName: string expected";
                if (message.endReason != null && $Object.hasOwnProperty.call(message, "endReason"))
                    switch (message.endReason) {
                    default:
                        return "endReason: enum value expected";
                    case 0:
                    case 1:
                    case 2:
                    case 3:
                    case 4:
                    case 5:
                    case 6:
                        break;
                    }
                if (message.status != null && $Object.hasOwnProperty.call(message, "status")) {
                    let error = $root.easemob.pb.ConferenceBody.Status.verify(message.status, _depth + 1);
                    if (error)
                        return "status." + error;
                }
                if (message.isDirect != null && $Object.hasOwnProperty.call(message, "isDirect"))
                    if (typeof message.isDirect !== "boolean")
                        return "isDirect: boolean expected";
                if (message.controlType != null && $Object.hasOwnProperty.call(message, "controlType"))
                    switch (message.controlType) {
                    default:
                        return "controlType: enum value expected";
                    case 0:
                    case 1:
                    case 2:
                    case 3:
                        break;
                    }
                if (message.routeFlag != null && $Object.hasOwnProperty.call(message, "routeFlag"))
                    if (!$util.isInteger(message.routeFlag))
                        return "routeFlag: integer expected";
                if (message.routeKey != null && $Object.hasOwnProperty.call(message, "routeKey"))
                    if (!$util.isString(message.routeKey))
                        return "routeKey: string expected";
                return null;
            };

            ConferenceBody.fromObject = function (object, _depth) {
                if (object instanceof $root.easemob.pb.ConferenceBody)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".easemob.pb.ConferenceBody: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let message = new $root.easemob.pb.ConferenceBody();
                if (object.sessionId != null)
                    message.sessionId = $String(object.sessionId);
                switch (object.operation) {
                case "JOIN":
                case 0:
                    message.operation = 0;
                    break;
                case "INITIATE":
                case 1:
                    message.operation = 1;
                    break;
                case "ACCEPT_INITIATE":
                case 2:
                    message.operation = 2;
                    break;
                case "ANSWER":
                case 3:
                    message.operation = 3;
                    break;
                case "TERMINATE":
                case 4:
                    message.operation = 4;
                    break;
                case "REMOVE":
                case 5:
                    message.operation = 5;
                    break;
                case "STREAM_CONTROL":
                case 6:
                    message.operation = 6;
                    break;
                case "MEDIA_REQUEST":
                case 7:
                    message.operation = 7;
                    break;
                default:
                }
                if (object.conferenceId != null)
                    message.conferenceId = $String(object.conferenceId);
                switch (object.type) {
                case "VOICE":
                case 0:
                    message.type = 0;
                    break;
                case "VIDEO":
                case 1:
                    message.type = 1;
                    break;
                default:
                }
                if (object.content != null)
                    message.content = $String(object.content);
                if (object.network != null)
                    message.network = $String(object.network);
                if (object.version != null)
                    message.version = $String(object.version);
                switch (object.identity) {
                case "CALLER":
                case 0:
                    message.identity = 0;
                    break;
                case "CALLEE":
                case 1:
                    message.identity = 1;
                    break;
                default:
                }
                if (object.duration != null)
                    message.duration = $String(object.duration);
                if (object.peerName != null)
                    message.peerName = $String(object.peerName);
                switch (object.endReason) {
                case "HANGUP":
                case 0:
                    message.endReason = 0;
                    break;
                case "NORESPONSE":
                case 1:
                    message.endReason = 1;
                    break;
                case "REJECT":
                case 2:
                    message.endReason = 2;
                    break;
                case "BUSY":
                case 3:
                    message.endReason = 3;
                    break;
                case "FAIL":
                case 4:
                    message.endReason = 4;
                    break;
                case "UNSUPPORTED":
                case 5:
                    message.endReason = 5;
                    break;
                case "OFFLINE":
                case 6:
                    message.endReason = 6;
                    break;
                default:
                }
                if (object.status != null) {
                    if (!$util.isObject(object.status))
                        throw $TypeError(".easemob.pb.ConferenceBody.status: object expected");
                    message.status = $root.easemob.pb.ConferenceBody.Status.fromObject(object.status, _depth + 1);
                }
                if (object.isDirect != null)
                    message.isDirect = $Boolean(object.isDirect);
                switch (object.controlType) {
                case "PAUSE_VOICE":
                case 0:
                    message.controlType = 0;
                    break;
                case "RESUME_VOICE":
                case 1:
                    message.controlType = 1;
                    break;
                case "PAUSE_VIDEO":
                case 2:
                    message.controlType = 2;
                    break;
                case "RESUME_VIDEO":
                case 3:
                    message.controlType = 3;
                    break;
                default:
                }
                if (object.routeFlag != null)
                    message.routeFlag = object.routeFlag | 0;
                if (object.routeKey != null)
                    message.routeKey = $String(object.routeKey);
                return message;
            };

            ConferenceBody.toObject = function (message, options, _depth) {
                if (!options)
                    options = {};
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let object = {};
                if (options.defaults) {
                    object.sessionId = "";
                    object.operation = options.enums === $String ? "JOIN" : 0;
                    object.conferenceId = "";
                    object.type = options.enums === $String ? "VOICE" : 0;
                    object.content = "";
                    object.network = "";
                    object.version = "";
                    object.identity = options.enums === $String ? "CALLER" : 0;
                    object.duration = "";
                    object.peerName = "";
                    object.endReason = options.enums === $String ? "HANGUP" : 0;
                    object.status = null;
                    object.isDirect = false;
                    object.controlType = options.enums === $String ? "PAUSE_VOICE" : 0;
                    object.routeFlag = 0;
                    object.routeKey = "";
                }
                if (message.sessionId != null && $Object.hasOwnProperty.call(message, "sessionId"))
                    object.sessionId = message.sessionId;
                if (message.operation != null && $Object.hasOwnProperty.call(message, "operation"))
                    object.operation = options.enums === $String ? $root.easemob.pb.ConferenceBody.Operation[message.operation] === $undefined ? message.operation : $root.easemob.pb.ConferenceBody.Operation[message.operation] : message.operation;
                if (message.conferenceId != null && $Object.hasOwnProperty.call(message, "conferenceId"))
                    object.conferenceId = message.conferenceId;
                if (message.type != null && $Object.hasOwnProperty.call(message, "type"))
                    object.type = options.enums === $String ? $root.easemob.pb.ConferenceBody.Type[message.type] === $undefined ? message.type : $root.easemob.pb.ConferenceBody.Type[message.type] : message.type;
                if (message.content != null && $Object.hasOwnProperty.call(message, "content"))
                    object.content = message.content;
                if (message.network != null && $Object.hasOwnProperty.call(message, "network"))
                    object.network = message.network;
                if (message.version != null && $Object.hasOwnProperty.call(message, "version"))
                    object.version = message.version;
                if (message.identity != null && $Object.hasOwnProperty.call(message, "identity"))
                    object.identity = options.enums === $String ? $root.easemob.pb.ConferenceBody.Identity[message.identity] === $undefined ? message.identity : $root.easemob.pb.ConferenceBody.Identity[message.identity] : message.identity;
                if (message.duration != null && $Object.hasOwnProperty.call(message, "duration"))
                    object.duration = message.duration;
                if (message.peerName != null && $Object.hasOwnProperty.call(message, "peerName"))
                    object.peerName = message.peerName;
                if (message.endReason != null && $Object.hasOwnProperty.call(message, "endReason"))
                    object.endReason = options.enums === $String ? $root.easemob.pb.ConferenceBody.EndReason[message.endReason] === $undefined ? message.endReason : $root.easemob.pb.ConferenceBody.EndReason[message.endReason] : message.endReason;
                if (message.status != null && $Object.hasOwnProperty.call(message, "status"))
                    object.status = $root.easemob.pb.ConferenceBody.Status.toObject(message.status, options, _depth + 1);
                if (message.isDirect != null && $Object.hasOwnProperty.call(message, "isDirect"))
                    object.isDirect = message.isDirect;
                if (message.controlType != null && $Object.hasOwnProperty.call(message, "controlType"))
                    object.controlType = options.enums === $String ? $root.easemob.pb.ConferenceBody.StreamControlType[message.controlType] === $undefined ? message.controlType : $root.easemob.pb.ConferenceBody.StreamControlType[message.controlType] : message.controlType;
                if (message.routeFlag != null && $Object.hasOwnProperty.call(message, "routeFlag"))
                    object.routeFlag = message.routeFlag;
                if (message.routeKey != null && $Object.hasOwnProperty.call(message, "routeKey"))
                    object.routeKey = message.routeKey;
                return object;
            };

            ConferenceBody.prototype.toJSON = function() {
                return ConferenceBody.toObject(this, $protobuf.util.toJSONOptions);
            };

            ConferenceBody.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/easemob.pb.ConferenceBody";
            };

            ConferenceBody.Status = (function() {

                const Status = function (properties) {
                    if (properties)
                        for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                            if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                this[keys[i]] = properties[keys[i]];
                };

                Status.prototype.errorCode = 0;

                Status.create = function(properties) {
                    return new Status(properties);
                };

                Status.encode = function (message, writer, _depth) {
                    if (!writer)
                        writer = $Writer.create();
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $util.recursionLimit)
                        throw $Error("max depth exceeded");
                    if (message.errorCode != null && $Object.hasOwnProperty.call(message, "errorCode"))
                        writer.uint32(/* id 1, wireType 0 =*/8).int32(message.errorCode);
                    if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                        for (let i = 0; i < message.$unknowns.length; ++i)
                            writer.raw(message.$unknowns[i]);
                    return writer;
                };

                Status.encodeDelimited = function(message, writer) {
                    return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
                };

                Status.decode = function (reader, length, _end, _depth, _target) {
                    if (!(reader instanceof $Reader))
                        reader = $Reader.create(reader);
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $Reader.recursionLimit)
                        throw $Error("max depth exceeded");
                    let end, message;
                    if (length === $undefined)
                        end = reader.len;
                    else {
                        end = reader.pos + length;
                        if (end > reader.len)
                            throw $RangeError("index out of range");
                        length = reader.len;
                        reader.len = end;
                    }
                    message = _target || new $root.easemob.pb.ConferenceBody.Status();
                    while (reader.pos < end) {
                        let start = reader.pos;
                        let tag = reader.tag();
                        if (tag === _end) {
                            _end = $undefined;
                            break;
                        }
                        let wireType = tag & 7;
                        switch (tag >>>= 3) {
                        case 1: {
                                if (wireType !== 0)
                                    break;
                                message.errorCode = reader.int32();
                                continue;
                            }
                        }
                        reader.skipType(wireType, _depth, tag);
                        if (!reader.discardUnknown) {
                            $util.makeProp(message, "$unknowns", false);
                            (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                        }
                    }
                    if (length !== $undefined) {
                        if (reader.pos !== end)
                            throw $RangeError("index out of range");
                        reader.len = length;
                    }
                    if (_end !== $undefined)
                        throw $Error("missing end group");
                    return message;
                };

                Status.decodeDelimited = function(reader) {
                    if (!(reader instanceof $Reader))
                        reader = new $Reader(reader);
                    return this.decode(reader, reader.size());
                };

                Status.verify = function (message, _depth) {
                    if (typeof message !== "object" || message === null)
                        return "object expected";
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $util.recursionLimit)
                        return "max depth exceeded";
                    if (message.errorCode != null && $Object.hasOwnProperty.call(message, "errorCode"))
                        if (!$util.isInteger(message.errorCode))
                            return "errorCode: integer expected";
                    return null;
                };

                Status.fromObject = function (object, _depth) {
                    if (object instanceof $root.easemob.pb.ConferenceBody.Status)
                        return object;
                    if (!$util.isObject(object))
                        throw $TypeError(".easemob.pb.ConferenceBody.Status: object expected");
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $util.recursionLimit)
                        throw $Error("max depth exceeded");
                    let message = new $root.easemob.pb.ConferenceBody.Status();
                    if (object.errorCode != null)
                        message.errorCode = object.errorCode | 0;
                    return message;
                };

                Status.toObject = function (message, options, _depth) {
                    if (!options)
                        options = {};
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $util.recursionLimit)
                        throw $Error("max depth exceeded");
                    let object = {};
                    if (options.defaults)
                        object.errorCode = 0;
                    if (message.errorCode != null && $Object.hasOwnProperty.call(message, "errorCode"))
                        object.errorCode = message.errorCode;
                    return object;
                };

                Status.prototype.toJSON = function() {
                    return Status.toObject(this, $protobuf.util.toJSONOptions);
                };

                Status.getTypeUrl = function(prefix) {
                    if (prefix === $undefined)
                        prefix = "type.googleapis.com";
                    return prefix + "/easemob.pb.ConferenceBody.Status";
                };

                return Status;
            })();

            ConferenceBody.Operation = (function() {
                const valuesById = $Object.create(null), values = $Object.create(valuesById);
                values[valuesById[0] = "JOIN"] = 0;
                values[valuesById[1] = "INITIATE"] = 1;
                values[valuesById[2] = "ACCEPT_INITIATE"] = 2;
                values[valuesById[3] = "ANSWER"] = 3;
                values[valuesById[4] = "TERMINATE"] = 4;
                values[valuesById[5] = "REMOVE"] = 5;
                values[valuesById[6] = "STREAM_CONTROL"] = 6;
                values[valuesById[7] = "MEDIA_REQUEST"] = 7;
                return values;
            })();

            ConferenceBody.Type = (function() {
                const valuesById = $Object.create(null), values = $Object.create(valuesById);
                values[valuesById[0] = "VOICE"] = 0;
                values[valuesById[1] = "VIDEO"] = 1;
                return values;
            })();

            ConferenceBody.Identity = (function() {
                const valuesById = $Object.create(null), values = $Object.create(valuesById);
                values[valuesById[0] = "CALLER"] = 0;
                values[valuesById[1] = "CALLEE"] = 1;
                return values;
            })();

            ConferenceBody.EndReason = (function() {
                const valuesById = $Object.create(null), values = $Object.create(valuesById);
                values[valuesById[0] = "HANGUP"] = 0;
                values[valuesById[1] = "NORESPONSE"] = 1;
                values[valuesById[2] = "REJECT"] = 2;
                values[valuesById[3] = "BUSY"] = 3;
                values[valuesById[4] = "FAIL"] = 4;
                values[valuesById[5] = "UNSUPPORTED"] = 5;
                values[valuesById[6] = "OFFLINE"] = 6;
                return values;
            })();

            ConferenceBody.StreamControlType = (function() {
                const valuesById = $Object.create(null), values = $Object.create(valuesById);
                values[valuesById[0] = "PAUSE_VOICE"] = 0;
                values[valuesById[1] = "RESUME_VOICE"] = 1;
                values[valuesById[2] = "PAUSE_VIDEO"] = 2;
                values[valuesById[3] = "RESUME_VIDEO"] = 3;
                return values;
            })();

            return ConferenceBody;
        })();

        pb.MSync = (function() {

            const MSync = function (properties) {
                this.encryptType = [];
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            MSync.prototype.version = 0;

            MSync.prototype.guid = null;

            MSync.prototype.auth = "";

            MSync.prototype.compressAlgorimth = 0;

            MSync.prototype.crypto = 0;

            MSync.prototype.userAgent = "";

            MSync.prototype.pov = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

            MSync.prototype.command = 0;

            MSync.prototype.deviceId = 0;

            MSync.prototype.encryptType = $util.emptyArray;

            MSync.prototype.encryptKey = "";

            MSync.prototype.payload = $util.newBuffer([]);

            MSync.create = function(properties) {
                return new MSync(properties);
            };

            MSync.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                if (message.version != null && $Object.hasOwnProperty.call(message, "version"))
                    writer.uint32(/* id 1, wireType 0 =*/8).int32(message.version);
                if (message.guid != null && $Object.hasOwnProperty.call(message, "guid"))
                    $root.easemob.pb.JID.encode(message.guid, writer.uint32(/* id 2, wireType 2 =*/18).fork(), _depth + 1).ldelim();
                if (message.auth != null && $Object.hasOwnProperty.call(message, "auth"))
                    writer.uint32(/* id 3, wireType 2 =*/26).string(message.auth);
                if (message.compressAlgorimth != null && $Object.hasOwnProperty.call(message, "compressAlgorimth"))
                    writer.uint32(/* id 4, wireType 0 =*/32).uint32(message.compressAlgorimth);
                if (message.crypto != null && $Object.hasOwnProperty.call(message, "crypto"))
                    writer.uint32(/* id 5, wireType 0 =*/40).uint32(message.crypto);
                if (message.userAgent != null && $Object.hasOwnProperty.call(message, "userAgent"))
                    writer.uint32(/* id 6, wireType 2 =*/50).string(message.userAgent);
                if (message.pov != null && $Object.hasOwnProperty.call(message, "pov"))
                    writer.uint32(/* id 7, wireType 0 =*/56).uint64(message.pov);
                if (message.command != null && $Object.hasOwnProperty.call(message, "command"))
                    writer.uint32(/* id 8, wireType 0 =*/64).int32(message.command);
                if (message.payload != null && $Object.hasOwnProperty.call(message, "payload"))
                    writer.uint32(/* id 9, wireType 2 =*/74).bytes(message.payload);
                if (message.deviceId != null && $Object.hasOwnProperty.call(message, "deviceId"))
                    writer.uint32(/* id 10, wireType 0 =*/80).uint32(message.deviceId);
                if (message.encryptType != null && message.encryptType.length)
                    for (let i = 0; i < message.encryptType.length; ++i)
                        writer.uint32(/* id 11, wireType 0 =*/88).int32(message.encryptType[i]);
                if (message.encryptKey != null && $Object.hasOwnProperty.call(message, "encryptKey"))
                    writer.uint32(/* id 12, wireType 2 =*/98).string(message.encryptKey);
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            MSync.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            MSync.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end, message, value;
                if (length === $undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw $RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = _target || new $root.easemob.pb.MSync();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType !== 0)
                                break;
                            value = reader.int32();
                            if ($root.easemob.pb.MSync.Version[value] !== $undefined)
                                message.version = value;
                            else if (!reader.discardUnknown) {
                                $util.makeProp(message, "$unknowns", false);
                                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                            }
                            continue;
                        }
                    case 2: {
                            if (wireType !== 2)
                                break;
                            message.guid = $root.easemob.pb.JID.decode(reader, reader.size(), $undefined, _depth + 1, message.guid);
                            continue;
                        }
                    case 3: {
                            if (wireType !== 2)
                                break;
                            message.auth = reader.string();
                            continue;
                        }
                    case 4: {
                            if (wireType !== 0)
                                break;
                            message.compressAlgorimth = reader.uint32();
                            continue;
                        }
                    case 5: {
                            if (wireType !== 0)
                                break;
                            message.crypto = reader.uint32();
                            continue;
                        }
                    case 6: {
                            if (wireType !== 2)
                                break;
                            message.userAgent = reader.string();
                            continue;
                        }
                    case 7: {
                            if (wireType !== 0)
                                break;
                            message.pov = reader.uint64();
                            continue;
                        }
                    case 8: {
                            if (wireType !== 0)
                                break;
                            value = reader.int32();
                            if ($root.easemob.pb.MSync.Command[value] !== $undefined)
                                message.command = value;
                            else if (!reader.discardUnknown) {
                                $util.makeProp(message, "$unknowns", false);
                                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                            }
                            continue;
                        }
                    case 10: {
                            if (wireType !== 0)
                                break;
                            message.deviceId = reader.uint32();
                            continue;
                        }
                    case 11: {
                            if (wireType === 2) {
                                if (!(message.encryptType && message.encryptType.length))
                                    message.encryptType = [];
                                reader.int32s(message.encryptType);
                                continue;
                            }
                            if (wireType !== 0)
                                break;
                            if (!(message.encryptType && message.encryptType.length))
                                message.encryptType = [];
                            message.encryptType.push(reader.int32());
                            continue;
                        }
                    case 12: {
                            if (wireType !== 2)
                                break;
                            message.encryptKey = reader.string();
                            continue;
                        }
                    case 9: {
                            if (wireType !== 2)
                                break;
                            message.payload = reader.bytes();
                            continue;
                        }
                    }
                    reader.skipType(wireType, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (length !== $undefined) {
                    if (reader.pos !== end)
                        throw $RangeError("index out of range");
                    reader.len = length;
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                return message;
            };

            MSync.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.size());
            };

            MSync.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                if (message.version != null && $Object.hasOwnProperty.call(message, "version"))
                    switch (message.version) {
                    default:
                        return "version: enum value expected";
                    case 0:
                    case 1:
                        break;
                    }
                if (message.guid != null && $Object.hasOwnProperty.call(message, "guid")) {
                    let error = $root.easemob.pb.JID.verify(message.guid, _depth + 1);
                    if (error)
                        return "guid." + error;
                }
                if (message.auth != null && $Object.hasOwnProperty.call(message, "auth"))
                    if (!$util.isString(message.auth))
                        return "auth: string expected";
                if (message.compressAlgorimth != null && $Object.hasOwnProperty.call(message, "compressAlgorimth"))
                    if (!$util.isInteger(message.compressAlgorimth))
                        return "compressAlgorimth: integer expected";
                if (message.crypto != null && $Object.hasOwnProperty.call(message, "crypto"))
                    if (!$util.isInteger(message.crypto))
                        return "crypto: integer expected";
                if (message.userAgent != null && $Object.hasOwnProperty.call(message, "userAgent"))
                    if (!$util.isString(message.userAgent))
                        return "userAgent: string expected";
                if (message.pov != null && $Object.hasOwnProperty.call(message, "pov"))
                    if (!$util.isInteger(message.pov) && !(message.pov && $util.isInteger(message.pov.low) && $util.isInteger(message.pov.high)))
                        return "pov: integer|Long expected";
                if (message.command != null && $Object.hasOwnProperty.call(message, "command"))
                    switch (message.command) {
                    default:
                        return "command: enum value expected";
                    case 0:
                    case 1:
                    case 2:
                    case 3:
                        break;
                    }
                if (message.deviceId != null && $Object.hasOwnProperty.call(message, "deviceId"))
                    if (!$util.isInteger(message.deviceId))
                        return "deviceId: integer expected";
                if (message.encryptType != null && $Object.hasOwnProperty.call(message, "encryptType")) {
                    if (!$Array.isArray(message.encryptType))
                        return "encryptType: array expected";
                    for (let i = 0; i < message.encryptType.length; ++i)
                        if (typeof message.encryptType[i] !== "number" || (message.encryptType[i] | 0) !== message.encryptType[i])
                            return "encryptType: enum value[] expected";
                }
                if (message.encryptKey != null && $Object.hasOwnProperty.call(message, "encryptKey"))
                    if (!$util.isString(message.encryptKey))
                        return "encryptKey: string expected";
                if (message.payload != null && $Object.hasOwnProperty.call(message, "payload"))
                    if (!(message.payload && typeof message.payload.length === "number" || $util.isString(message.payload)))
                        return "payload: buffer expected";
                return null;
            };

            MSync.fromObject = function (object, _depth) {
                if (object instanceof $root.easemob.pb.MSync)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".easemob.pb.MSync: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let message = new $root.easemob.pb.MSync();
                switch (object.version) {
                case "MSYNC_V1":
                case 0:
                    message.version = 0;
                    break;
                case "MSYNC_V2":
                case 1:
                    message.version = 1;
                    break;
                default:
                }
                if (object.guid != null) {
                    if (!$util.isObject(object.guid))
                        throw $TypeError(".easemob.pb.MSync.guid: object expected");
                    message.guid = $root.easemob.pb.JID.fromObject(object.guid, _depth + 1);
                }
                if (object.auth != null)
                    message.auth = $String(object.auth);
                if (object.compressAlgorimth != null)
                    message.compressAlgorimth = object.compressAlgorimth >>> 0;
                if (object.crypto != null)
                    message.crypto = object.crypto >>> 0;
                if (object.userAgent != null)
                    message.userAgent = $String(object.userAgent);
                if (object.pov != null)
                    if ($util.Long)
                        message.pov = $util.Long.fromValue(object.pov, true);
                    else if (typeof object.pov === "string")
                        message.pov = $parseInt(object.pov, 10);
                    else if (typeof object.pov === "number")
                        message.pov = object.pov;
                    else if (typeof object.pov === "object")
                        message.pov = new $util.LongBits(object.pov.low >>> 0, object.pov.high >>> 0).toNumber(true);
                switch (object.command) {
                case "SYNC":
                case 0:
                    message.command = 0;
                    break;
                case "UNREAD":
                case 1:
                    message.command = 1;
                    break;
                case "NOTICE":
                case 2:
                    message.command = 2;
                    break;
                case "PROVISION":
                case 3:
                    message.command = 3;
                    break;
                default:
                }
                if (object.deviceId != null)
                    message.deviceId = object.deviceId >>> 0;
                if (object.encryptType) {
                    if (!$Array.isArray(object.encryptType))
                        throw $TypeError(".easemob.pb.MSync.encryptType: array expected");
                    message.encryptType = [];
                    for (let i = 0; i < object.encryptType.length; ++i)
                        switch (object.encryptType[i]) {
                        case "ENCRYPT_NONE":
                        case 0:
                            message.encryptType[message.encryptType.length] = 0;
                            break;
                        case "ENCRYPT_AES_128_CBC":
                        case 1:
                            message.encryptType[message.encryptType.length] = 1;
                            break;
                        case "ENCRYPT_AES_256_CBC":
                        case 2:
                            message.encryptType[message.encryptType.length] = 2;
                            break;
                        default:
                            if (typeof object.encryptType[i] === "number" && (object.encryptType[i] | 0) === object.encryptType[i])
                                message.encryptType[message.encryptType.length] = object.encryptType[i];
                        }
                }
                if (object.encryptKey != null)
                    message.encryptKey = $String(object.encryptKey);
                if (object.payload != null)
                    if (typeof object.payload === "string")
                        $util.base64.decode(object.payload, message.payload = $util.newBuffer($util.base64.length(object.payload)), 0);
                    else if (object.payload.length >= 0)
                        message.payload = object.payload;
                return message;
            };

            MSync.toObject = function (message, options, _depth) {
                if (!options)
                    options = {};
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let object = {};
                if (options.arrays || options.defaults)
                    object.encryptType = [];
                if (options.defaults) {
                    object.version = options.enums === $String ? "MSYNC_V1" : 0;
                    object.guid = null;
                    object.auth = "";
                    object.compressAlgorimth = 0;
                    object.crypto = 0;
                    object.userAgent = "";
                    if ($util.Long) {
                        let long = new $util.Long(0, 0, true);
                        object.pov = options.longs === $String ? long.toString() : options.longs === $Number ? long.toNumber() : typeof $BigInt !== "undefined" && options.longs === $BigInt ? long.toBigInt() : long;
                    } else
                        object.pov = options.longs === $String ? "0" : typeof $BigInt !== "undefined" && options.longs === $BigInt ? $BigInt("0") : 0;
                    object.command = options.enums === $String ? "SYNC" : 0;
                    if (options.bytes === $String)
                        object.payload = "";
                    else {
                        object.payload = [];
                        if (options.bytes !== $Array)
                            object.payload = $util.newBuffer(object.payload);
                    }
                    object.deviceId = 0;
                    object.encryptKey = "";
                }
                if (message.version != null && $Object.hasOwnProperty.call(message, "version"))
                    object.version = options.enums === $String ? $root.easemob.pb.MSync.Version[message.version] === $undefined ? message.version : $root.easemob.pb.MSync.Version[message.version] : message.version;
                if (message.guid != null && $Object.hasOwnProperty.call(message, "guid"))
                    object.guid = $root.easemob.pb.JID.toObject(message.guid, options, _depth + 1);
                if (message.auth != null && $Object.hasOwnProperty.call(message, "auth"))
                    object.auth = message.auth;
                if (message.compressAlgorimth != null && $Object.hasOwnProperty.call(message, "compressAlgorimth"))
                    object.compressAlgorimth = message.compressAlgorimth;
                if (message.crypto != null && $Object.hasOwnProperty.call(message, "crypto"))
                    object.crypto = message.crypto;
                if (message.userAgent != null && $Object.hasOwnProperty.call(message, "userAgent"))
                    object.userAgent = message.userAgent;
                if (message.pov != null && $Object.hasOwnProperty.call(message, "pov"))
                    if (typeof $BigInt !== "undefined" && options.longs === $BigInt)
                        object.pov = typeof message.pov === "number" ? $BigInt(message.pov) : $util.Long.fromBits(message.pov.low >>> 0, message.pov.high >>> 0, true).toBigInt();
                    else if (typeof message.pov === "number")
                        object.pov = options.longs === $String ? $String(message.pov) : message.pov;
                    else
                        object.pov = options.longs === $String ? $util.Long.prototype.toString.call(message.pov) : options.longs === $Number ? new $util.LongBits(message.pov.low >>> 0, message.pov.high >>> 0).toNumber(true) : message.pov;
                if (message.command != null && $Object.hasOwnProperty.call(message, "command"))
                    object.command = options.enums === $String ? $root.easemob.pb.MSync.Command[message.command] === $undefined ? message.command : $root.easemob.pb.MSync.Command[message.command] : message.command;
                if (message.payload != null && $Object.hasOwnProperty.call(message, "payload"))
                    object.payload = options.bytes === $String ? $util.base64.encode(message.payload, 0, message.payload.length) : options.bytes === $Array ? $Array.prototype.slice.call(message.payload) : message.payload;
                if (message.deviceId != null && $Object.hasOwnProperty.call(message, "deviceId"))
                    object.deviceId = message.deviceId;
                if (message.encryptType && message.encryptType.length) {
                    object.encryptType = $Array(message.encryptType.length);
                    for (let j = 0; j < message.encryptType.length; ++j)
                        object.encryptType[j] = options.enums === $String ? $root.easemob.pb.EncryptType[message.encryptType[j]] === $undefined ? message.encryptType[j] : $root.easemob.pb.EncryptType[message.encryptType[j]] : message.encryptType[j];
                }
                if (message.encryptKey != null && $Object.hasOwnProperty.call(message, "encryptKey"))
                    object.encryptKey = message.encryptKey;
                return object;
            };

            MSync.prototype.toJSON = function() {
                return MSync.toObject(this, $protobuf.util.toJSONOptions);
            };

            MSync.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/easemob.pb.MSync";
            };

            MSync.Version = (function() {
                const valuesById = $Object.create(null), values = $Object.create(valuesById);
                values[valuesById[0] = "MSYNC_V1"] = 0;
                values[valuesById[1] = "MSYNC_V2"] = 1;
                return values;
            })();

            MSync.Command = (function() {
                const valuesById = $Object.create(null), values = $Object.create(valuesById);
                values[valuesById[0] = "SYNC"] = 0;
                values[valuesById[1] = "UNREAD"] = 1;
                values[valuesById[2] = "NOTICE"] = 2;
                values[valuesById[3] = "PROVISION"] = 3;
                return values;
            })();

            return MSync;
        })();

        pb.EncryptType = (function() {
            const valuesById = $Object.create(null), values = $Object.create(valuesById);
            values[valuesById[0] = "ENCRYPT_NONE"] = 0;
            values[valuesById[1] = "ENCRYPT_AES_128_CBC"] = 1;
            values[valuesById[2] = "ENCRYPT_AES_256_CBC"] = 2;
            return values;
        })();

        pb.CommSyncUL = (function() {

            const CommSyncUL = function (properties) {
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            CommSyncUL.prototype.meta = null;

            CommSyncUL.prototype.key = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

            CommSyncUL.prototype.queue = null;

            CommSyncUL.prototype.isRoam = false;

            CommSyncUL.prototype.lastFullRoamKey = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

            CommSyncUL.create = function(properties) {
                return new CommSyncUL(properties);
            };

            CommSyncUL.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                if (message.meta != null && $Object.hasOwnProperty.call(message, "meta"))
                    $root.easemob.pb.Meta.encode(message.meta, writer.uint32(/* id 1, wireType 2 =*/10).fork(), _depth + 1).ldelim();
                if (message.key != null && $Object.hasOwnProperty.call(message, "key"))
                    writer.uint32(/* id 2, wireType 0 =*/16).uint64(message.key);
                if (message.queue != null && $Object.hasOwnProperty.call(message, "queue"))
                    $root.easemob.pb.JID.encode(message.queue, writer.uint32(/* id 3, wireType 2 =*/26).fork(), _depth + 1).ldelim();
                if (message.isRoam != null && $Object.hasOwnProperty.call(message, "isRoam"))
                    writer.uint32(/* id 4, wireType 0 =*/32).bool(message.isRoam);
                if (message.lastFullRoamKey != null && $Object.hasOwnProperty.call(message, "lastFullRoamKey"))
                    writer.uint32(/* id 5, wireType 0 =*/40).uint64(message.lastFullRoamKey);
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            CommSyncUL.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            CommSyncUL.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end, message;
                if (length === $undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw $RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = _target || new $root.easemob.pb.CommSyncUL();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType !== 2)
                                break;
                            message.meta = $root.easemob.pb.Meta.decode(reader, reader.size(), $undefined, _depth + 1, message.meta);
                            continue;
                        }
                    case 2: {
                            if (wireType !== 0)
                                break;
                            message.key = reader.uint64();
                            continue;
                        }
                    case 3: {
                            if (wireType !== 2)
                                break;
                            message.queue = $root.easemob.pb.JID.decode(reader, reader.size(), $undefined, _depth + 1, message.queue);
                            continue;
                        }
                    case 4: {
                            if (wireType !== 0)
                                break;
                            message.isRoam = reader.bool();
                            continue;
                        }
                    case 5: {
                            if (wireType !== 0)
                                break;
                            message.lastFullRoamKey = reader.uint64();
                            continue;
                        }
                    }
                    reader.skipType(wireType, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (length !== $undefined) {
                    if (reader.pos !== end)
                        throw $RangeError("index out of range");
                    reader.len = length;
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                return message;
            };

            CommSyncUL.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.size());
            };

            CommSyncUL.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                if (message.meta != null && $Object.hasOwnProperty.call(message, "meta")) {
                    let error = $root.easemob.pb.Meta.verify(message.meta, _depth + 1);
                    if (error)
                        return "meta." + error;
                }
                if (message.key != null && $Object.hasOwnProperty.call(message, "key"))
                    if (!$util.isInteger(message.key) && !(message.key && $util.isInteger(message.key.low) && $util.isInteger(message.key.high)))
                        return "key: integer|Long expected";
                if (message.queue != null && $Object.hasOwnProperty.call(message, "queue")) {
                    let error = $root.easemob.pb.JID.verify(message.queue, _depth + 1);
                    if (error)
                        return "queue." + error;
                }
                if (message.isRoam != null && $Object.hasOwnProperty.call(message, "isRoam"))
                    if (typeof message.isRoam !== "boolean")
                        return "isRoam: boolean expected";
                if (message.lastFullRoamKey != null && $Object.hasOwnProperty.call(message, "lastFullRoamKey"))
                    if (!$util.isInteger(message.lastFullRoamKey) && !(message.lastFullRoamKey && $util.isInteger(message.lastFullRoamKey.low) && $util.isInteger(message.lastFullRoamKey.high)))
                        return "lastFullRoamKey: integer|Long expected";
                return null;
            };

            CommSyncUL.fromObject = function (object, _depth) {
                if (object instanceof $root.easemob.pb.CommSyncUL)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".easemob.pb.CommSyncUL: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let message = new $root.easemob.pb.CommSyncUL();
                if (object.meta != null) {
                    if (!$util.isObject(object.meta))
                        throw $TypeError(".easemob.pb.CommSyncUL.meta: object expected");
                    message.meta = $root.easemob.pb.Meta.fromObject(object.meta, _depth + 1);
                }
                if (object.key != null)
                    if ($util.Long)
                        message.key = $util.Long.fromValue(object.key, true);
                    else if (typeof object.key === "string")
                        message.key = $parseInt(object.key, 10);
                    else if (typeof object.key === "number")
                        message.key = object.key;
                    else if (typeof object.key === "object")
                        message.key = new $util.LongBits(object.key.low >>> 0, object.key.high >>> 0).toNumber(true);
                if (object.queue != null) {
                    if (!$util.isObject(object.queue))
                        throw $TypeError(".easemob.pb.CommSyncUL.queue: object expected");
                    message.queue = $root.easemob.pb.JID.fromObject(object.queue, _depth + 1);
                }
                if (object.isRoam != null)
                    message.isRoam = $Boolean(object.isRoam);
                if (object.lastFullRoamKey != null)
                    if ($util.Long)
                        message.lastFullRoamKey = $util.Long.fromValue(object.lastFullRoamKey, true);
                    else if (typeof object.lastFullRoamKey === "string")
                        message.lastFullRoamKey = $parseInt(object.lastFullRoamKey, 10);
                    else if (typeof object.lastFullRoamKey === "number")
                        message.lastFullRoamKey = object.lastFullRoamKey;
                    else if (typeof object.lastFullRoamKey === "object")
                        message.lastFullRoamKey = new $util.LongBits(object.lastFullRoamKey.low >>> 0, object.lastFullRoamKey.high >>> 0).toNumber(true);
                return message;
            };

            CommSyncUL.toObject = function (message, options, _depth) {
                if (!options)
                    options = {};
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let object = {};
                if (options.defaults) {
                    object.meta = null;
                    if ($util.Long) {
                        let long = new $util.Long(0, 0, true);
                        object.key = options.longs === $String ? long.toString() : options.longs === $Number ? long.toNumber() : typeof $BigInt !== "undefined" && options.longs === $BigInt ? long.toBigInt() : long;
                    } else
                        object.key = options.longs === $String ? "0" : typeof $BigInt !== "undefined" && options.longs === $BigInt ? $BigInt("0") : 0;
                    object.queue = null;
                    object.isRoam = false;
                    if ($util.Long) {
                        let long = new $util.Long(0, 0, true);
                        object.lastFullRoamKey = options.longs === $String ? long.toString() : options.longs === $Number ? long.toNumber() : typeof $BigInt !== "undefined" && options.longs === $BigInt ? long.toBigInt() : long;
                    } else
                        object.lastFullRoamKey = options.longs === $String ? "0" : typeof $BigInt !== "undefined" && options.longs === $BigInt ? $BigInt("0") : 0;
                }
                if (message.meta != null && $Object.hasOwnProperty.call(message, "meta"))
                    object.meta = $root.easemob.pb.Meta.toObject(message.meta, options, _depth + 1);
                if (message.key != null && $Object.hasOwnProperty.call(message, "key"))
                    if (typeof $BigInt !== "undefined" && options.longs === $BigInt)
                        object.key = typeof message.key === "number" ? $BigInt(message.key) : $util.Long.fromBits(message.key.low >>> 0, message.key.high >>> 0, true).toBigInt();
                    else if (typeof message.key === "number")
                        object.key = options.longs === $String ? $String(message.key) : message.key;
                    else
                        object.key = options.longs === $String ? $util.Long.prototype.toString.call(message.key) : options.longs === $Number ? new $util.LongBits(message.key.low >>> 0, message.key.high >>> 0).toNumber(true) : message.key;
                if (message.queue != null && $Object.hasOwnProperty.call(message, "queue"))
                    object.queue = $root.easemob.pb.JID.toObject(message.queue, options, _depth + 1);
                if (message.isRoam != null && $Object.hasOwnProperty.call(message, "isRoam"))
                    object.isRoam = message.isRoam;
                if (message.lastFullRoamKey != null && $Object.hasOwnProperty.call(message, "lastFullRoamKey"))
                    if (typeof $BigInt !== "undefined" && options.longs === $BigInt)
                        object.lastFullRoamKey = typeof message.lastFullRoamKey === "number" ? $BigInt(message.lastFullRoamKey) : $util.Long.fromBits(message.lastFullRoamKey.low >>> 0, message.lastFullRoamKey.high >>> 0, true).toBigInt();
                    else if (typeof message.lastFullRoamKey === "number")
                        object.lastFullRoamKey = options.longs === $String ? $String(message.lastFullRoamKey) : message.lastFullRoamKey;
                    else
                        object.lastFullRoamKey = options.longs === $String ? $util.Long.prototype.toString.call(message.lastFullRoamKey) : options.longs === $Number ? new $util.LongBits(message.lastFullRoamKey.low >>> 0, message.lastFullRoamKey.high >>> 0).toNumber(true) : message.lastFullRoamKey;
                return object;
            };

            CommSyncUL.prototype.toJSON = function() {
                return CommSyncUL.toObject(this, $protobuf.util.toJSONOptions);
            };

            CommSyncUL.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/easemob.pb.CommSyncUL";
            };

            return CommSyncUL;
        })();

        pb.CommSyncDL = (function() {

            const CommSyncDL = function (properties) {
                this.metas = [];
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            CommSyncDL.prototype.status = null;

            CommSyncDL.prototype.metaId = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

            CommSyncDL.prototype.serverId = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

            CommSyncDL.prototype.metas = $util.emptyArray;

            CommSyncDL.prototype.nextKey = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

            CommSyncDL.prototype.queue = null;

            CommSyncDL.prototype.isLast = false;

            CommSyncDL.prototype.timestamp = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

            CommSyncDL.prototype.isRoam = false;

            CommSyncDL.create = function(properties) {
                return new CommSyncDL(properties);
            };

            CommSyncDL.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                if (message.status != null && $Object.hasOwnProperty.call(message, "status"))
                    $root.easemob.pb.Status.encode(message.status, writer.uint32(/* id 1, wireType 2 =*/10).fork(), _depth + 1).ldelim();
                if (message.metaId != null && $Object.hasOwnProperty.call(message, "metaId"))
                    writer.uint32(/* id 2, wireType 0 =*/16).uint64(message.metaId);
                if (message.serverId != null && $Object.hasOwnProperty.call(message, "serverId"))
                    writer.uint32(/* id 3, wireType 0 =*/24).uint64(message.serverId);
                if (message.metas != null && message.metas.length)
                    for (let i = 0; i < message.metas.length; ++i)
                        $root.easemob.pb.Meta.encode(message.metas[i], writer.uint32(/* id 4, wireType 2 =*/34).fork(), _depth + 1).ldelim();
                if (message.nextKey != null && $Object.hasOwnProperty.call(message, "nextKey"))
                    writer.uint32(/* id 5, wireType 0 =*/40).uint64(message.nextKey);
                if (message.queue != null && $Object.hasOwnProperty.call(message, "queue"))
                    $root.easemob.pb.JID.encode(message.queue, writer.uint32(/* id 6, wireType 2 =*/50).fork(), _depth + 1).ldelim();
                if (message.isLast != null && $Object.hasOwnProperty.call(message, "isLast"))
                    writer.uint32(/* id 7, wireType 0 =*/56).bool(message.isLast);
                if (message.timestamp != null && $Object.hasOwnProperty.call(message, "timestamp"))
                    writer.uint32(/* id 8, wireType 0 =*/64).uint64(message.timestamp);
                if (message.isRoam != null && $Object.hasOwnProperty.call(message, "isRoam"))
                    writer.uint32(/* id 9, wireType 0 =*/72).bool(message.isRoam);
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            CommSyncDL.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            CommSyncDL.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end, message;
                if (length === $undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw $RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = _target || new $root.easemob.pb.CommSyncDL();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType !== 2)
                                break;
                            message.status = $root.easemob.pb.Status.decode(reader, reader.size(), $undefined, _depth + 1, message.status);
                            continue;
                        }
                    case 2: {
                            if (wireType !== 0)
                                break;
                            message.metaId = reader.uint64();
                            continue;
                        }
                    case 3: {
                            if (wireType !== 0)
                                break;
                            message.serverId = reader.uint64();
                            continue;
                        }
                    case 4: {
                            if (wireType !== 2)
                                break;
                            if (!(message.metas && message.metas.length))
                                message.metas = [];
                            message.metas.push($root.easemob.pb.Meta.decode(reader, reader.size(), $undefined, _depth + 1));
                            continue;
                        }
                    case 5: {
                            if (wireType !== 0)
                                break;
                            message.nextKey = reader.uint64();
                            continue;
                        }
                    case 6: {
                            if (wireType !== 2)
                                break;
                            message.queue = $root.easemob.pb.JID.decode(reader, reader.size(), $undefined, _depth + 1, message.queue);
                            continue;
                        }
                    case 7: {
                            if (wireType !== 0)
                                break;
                            message.isLast = reader.bool();
                            continue;
                        }
                    case 8: {
                            if (wireType !== 0)
                                break;
                            message.timestamp = reader.uint64();
                            continue;
                        }
                    case 9: {
                            if (wireType !== 0)
                                break;
                            message.isRoam = reader.bool();
                            continue;
                        }
                    }
                    reader.skipType(wireType, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (length !== $undefined) {
                    if (reader.pos !== end)
                        throw $RangeError("index out of range");
                    reader.len = length;
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                return message;
            };

            CommSyncDL.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.size());
            };

            CommSyncDL.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                if (message.status != null && $Object.hasOwnProperty.call(message, "status")) {
                    let error = $root.easemob.pb.Status.verify(message.status, _depth + 1);
                    if (error)
                        return "status." + error;
                }
                if (message.metaId != null && $Object.hasOwnProperty.call(message, "metaId"))
                    if (!$util.isInteger(message.metaId) && !(message.metaId && $util.isInteger(message.metaId.low) && $util.isInteger(message.metaId.high)))
                        return "metaId: integer|Long expected";
                if (message.serverId != null && $Object.hasOwnProperty.call(message, "serverId"))
                    if (!$util.isInteger(message.serverId) && !(message.serverId && $util.isInteger(message.serverId.low) && $util.isInteger(message.serverId.high)))
                        return "serverId: integer|Long expected";
                if (message.metas != null && $Object.hasOwnProperty.call(message, "metas")) {
                    if (!$Array.isArray(message.metas))
                        return "metas: array expected";
                    for (let i = 0; i < message.metas.length; ++i) {
                        let error = $root.easemob.pb.Meta.verify(message.metas[i], _depth + 1);
                        if (error)
                            return "metas." + error;
                    }
                }
                if (message.nextKey != null && $Object.hasOwnProperty.call(message, "nextKey"))
                    if (!$util.isInteger(message.nextKey) && !(message.nextKey && $util.isInteger(message.nextKey.low) && $util.isInteger(message.nextKey.high)))
                        return "nextKey: integer|Long expected";
                if (message.queue != null && $Object.hasOwnProperty.call(message, "queue")) {
                    let error = $root.easemob.pb.JID.verify(message.queue, _depth + 1);
                    if (error)
                        return "queue." + error;
                }
                if (message.isLast != null && $Object.hasOwnProperty.call(message, "isLast"))
                    if (typeof message.isLast !== "boolean")
                        return "isLast: boolean expected";
                if (message.timestamp != null && $Object.hasOwnProperty.call(message, "timestamp"))
                    if (!$util.isInteger(message.timestamp) && !(message.timestamp && $util.isInteger(message.timestamp.low) && $util.isInteger(message.timestamp.high)))
                        return "timestamp: integer|Long expected";
                if (message.isRoam != null && $Object.hasOwnProperty.call(message, "isRoam"))
                    if (typeof message.isRoam !== "boolean")
                        return "isRoam: boolean expected";
                return null;
            };

            CommSyncDL.fromObject = function (object, _depth) {
                if (object instanceof $root.easemob.pb.CommSyncDL)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".easemob.pb.CommSyncDL: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let message = new $root.easemob.pb.CommSyncDL();
                if (object.status != null) {
                    if (!$util.isObject(object.status))
                        throw $TypeError(".easemob.pb.CommSyncDL.status: object expected");
                    message.status = $root.easemob.pb.Status.fromObject(object.status, _depth + 1);
                }
                if (object.metaId != null)
                    if ($util.Long)
                        message.metaId = $util.Long.fromValue(object.metaId, true);
                    else if (typeof object.metaId === "string")
                        message.metaId = $parseInt(object.metaId, 10);
                    else if (typeof object.metaId === "number")
                        message.metaId = object.metaId;
                    else if (typeof object.metaId === "object")
                        message.metaId = new $util.LongBits(object.metaId.low >>> 0, object.metaId.high >>> 0).toNumber(true);
                if (object.serverId != null)
                    if ($util.Long)
                        message.serverId = $util.Long.fromValue(object.serverId, true);
                    else if (typeof object.serverId === "string")
                        message.serverId = $parseInt(object.serverId, 10);
                    else if (typeof object.serverId === "number")
                        message.serverId = object.serverId;
                    else if (typeof object.serverId === "object")
                        message.serverId = new $util.LongBits(object.serverId.low >>> 0, object.serverId.high >>> 0).toNumber(true);
                if (object.metas) {
                    if (!$Array.isArray(object.metas))
                        throw $TypeError(".easemob.pb.CommSyncDL.metas: array expected");
                    message.metas = $Array(object.metas.length);
                    for (let i = 0; i < object.metas.length; ++i) {
                        if (!$util.isObject(object.metas[i]))
                            throw $TypeError(".easemob.pb.CommSyncDL.metas: object expected");
                        message.metas[i] = $root.easemob.pb.Meta.fromObject(object.metas[i], _depth + 1);
                    }
                }
                if (object.nextKey != null)
                    if ($util.Long)
                        message.nextKey = $util.Long.fromValue(object.nextKey, true);
                    else if (typeof object.nextKey === "string")
                        message.nextKey = $parseInt(object.nextKey, 10);
                    else if (typeof object.nextKey === "number")
                        message.nextKey = object.nextKey;
                    else if (typeof object.nextKey === "object")
                        message.nextKey = new $util.LongBits(object.nextKey.low >>> 0, object.nextKey.high >>> 0).toNumber(true);
                if (object.queue != null) {
                    if (!$util.isObject(object.queue))
                        throw $TypeError(".easemob.pb.CommSyncDL.queue: object expected");
                    message.queue = $root.easemob.pb.JID.fromObject(object.queue, _depth + 1);
                }
                if (object.isLast != null)
                    message.isLast = $Boolean(object.isLast);
                if (object.timestamp != null)
                    if ($util.Long)
                        message.timestamp = $util.Long.fromValue(object.timestamp, true);
                    else if (typeof object.timestamp === "string")
                        message.timestamp = $parseInt(object.timestamp, 10);
                    else if (typeof object.timestamp === "number")
                        message.timestamp = object.timestamp;
                    else if (typeof object.timestamp === "object")
                        message.timestamp = new $util.LongBits(object.timestamp.low >>> 0, object.timestamp.high >>> 0).toNumber(true);
                if (object.isRoam != null)
                    message.isRoam = $Boolean(object.isRoam);
                return message;
            };

            CommSyncDL.toObject = function (message, options, _depth) {
                if (!options)
                    options = {};
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let object = {};
                if (options.arrays || options.defaults)
                    object.metas = [];
                if (options.defaults) {
                    object.status = null;
                    if ($util.Long) {
                        let long = new $util.Long(0, 0, true);
                        object.metaId = options.longs === $String ? long.toString() : options.longs === $Number ? long.toNumber() : typeof $BigInt !== "undefined" && options.longs === $BigInt ? long.toBigInt() : long;
                    } else
                        object.metaId = options.longs === $String ? "0" : typeof $BigInt !== "undefined" && options.longs === $BigInt ? $BigInt("0") : 0;
                    if ($util.Long) {
                        let long = new $util.Long(0, 0, true);
                        object.serverId = options.longs === $String ? long.toString() : options.longs === $Number ? long.toNumber() : typeof $BigInt !== "undefined" && options.longs === $BigInt ? long.toBigInt() : long;
                    } else
                        object.serverId = options.longs === $String ? "0" : typeof $BigInt !== "undefined" && options.longs === $BigInt ? $BigInt("0") : 0;
                    if ($util.Long) {
                        let long = new $util.Long(0, 0, true);
                        object.nextKey = options.longs === $String ? long.toString() : options.longs === $Number ? long.toNumber() : typeof $BigInt !== "undefined" && options.longs === $BigInt ? long.toBigInt() : long;
                    } else
                        object.nextKey = options.longs === $String ? "0" : typeof $BigInt !== "undefined" && options.longs === $BigInt ? $BigInt("0") : 0;
                    object.queue = null;
                    object.isLast = false;
                    if ($util.Long) {
                        let long = new $util.Long(0, 0, true);
                        object.timestamp = options.longs === $String ? long.toString() : options.longs === $Number ? long.toNumber() : typeof $BigInt !== "undefined" && options.longs === $BigInt ? long.toBigInt() : long;
                    } else
                        object.timestamp = options.longs === $String ? "0" : typeof $BigInt !== "undefined" && options.longs === $BigInt ? $BigInt("0") : 0;
                    object.isRoam = false;
                }
                if (message.status != null && $Object.hasOwnProperty.call(message, "status"))
                    object.status = $root.easemob.pb.Status.toObject(message.status, options, _depth + 1);
                if (message.metaId != null && $Object.hasOwnProperty.call(message, "metaId"))
                    if (typeof $BigInt !== "undefined" && options.longs === $BigInt)
                        object.metaId = typeof message.metaId === "number" ? $BigInt(message.metaId) : $util.Long.fromBits(message.metaId.low >>> 0, message.metaId.high >>> 0, true).toBigInt();
                    else if (typeof message.metaId === "number")
                        object.metaId = options.longs === $String ? $String(message.metaId) : message.metaId;
                    else
                        object.metaId = options.longs === $String ? $util.Long.prototype.toString.call(message.metaId) : options.longs === $Number ? new $util.LongBits(message.metaId.low >>> 0, message.metaId.high >>> 0).toNumber(true) : message.metaId;
                if (message.serverId != null && $Object.hasOwnProperty.call(message, "serverId"))
                    if (typeof $BigInt !== "undefined" && options.longs === $BigInt)
                        object.serverId = typeof message.serverId === "number" ? $BigInt(message.serverId) : $util.Long.fromBits(message.serverId.low >>> 0, message.serverId.high >>> 0, true).toBigInt();
                    else if (typeof message.serverId === "number")
                        object.serverId = options.longs === $String ? $String(message.serverId) : message.serverId;
                    else
                        object.serverId = options.longs === $String ? $util.Long.prototype.toString.call(message.serverId) : options.longs === $Number ? new $util.LongBits(message.serverId.low >>> 0, message.serverId.high >>> 0).toNumber(true) : message.serverId;
                if (message.metas && message.metas.length) {
                    object.metas = $Array(message.metas.length);
                    for (let j = 0; j < message.metas.length; ++j)
                        object.metas[j] = $root.easemob.pb.Meta.toObject(message.metas[j], options, _depth + 1);
                }
                if (message.nextKey != null && $Object.hasOwnProperty.call(message, "nextKey"))
                    if (typeof $BigInt !== "undefined" && options.longs === $BigInt)
                        object.nextKey = typeof message.nextKey === "number" ? $BigInt(message.nextKey) : $util.Long.fromBits(message.nextKey.low >>> 0, message.nextKey.high >>> 0, true).toBigInt();
                    else if (typeof message.nextKey === "number")
                        object.nextKey = options.longs === $String ? $String(message.nextKey) : message.nextKey;
                    else
                        object.nextKey = options.longs === $String ? $util.Long.prototype.toString.call(message.nextKey) : options.longs === $Number ? new $util.LongBits(message.nextKey.low >>> 0, message.nextKey.high >>> 0).toNumber(true) : message.nextKey;
                if (message.queue != null && $Object.hasOwnProperty.call(message, "queue"))
                    object.queue = $root.easemob.pb.JID.toObject(message.queue, options, _depth + 1);
                if (message.isLast != null && $Object.hasOwnProperty.call(message, "isLast"))
                    object.isLast = message.isLast;
                if (message.timestamp != null && $Object.hasOwnProperty.call(message, "timestamp"))
                    if (typeof $BigInt !== "undefined" && options.longs === $BigInt)
                        object.timestamp = typeof message.timestamp === "number" ? $BigInt(message.timestamp) : $util.Long.fromBits(message.timestamp.low >>> 0, message.timestamp.high >>> 0, true).toBigInt();
                    else if (typeof message.timestamp === "number")
                        object.timestamp = options.longs === $String ? $String(message.timestamp) : message.timestamp;
                    else
                        object.timestamp = options.longs === $String ? $util.Long.prototype.toString.call(message.timestamp) : options.longs === $Number ? new $util.LongBits(message.timestamp.low >>> 0, message.timestamp.high >>> 0).toNumber(true) : message.timestamp;
                if (message.isRoam != null && $Object.hasOwnProperty.call(message, "isRoam"))
                    object.isRoam = message.isRoam;
                return object;
            };

            CommSyncDL.prototype.toJSON = function() {
                return CommSyncDL.toObject(this, $protobuf.util.toJSONOptions);
            };

            CommSyncDL.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/easemob.pb.CommSyncDL";
            };

            return CommSyncDL;
        })();

        pb.CommNotice = (function() {

            const CommNotice = function (properties) {
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            CommNotice.prototype.queue = null;

            CommNotice.create = function(properties) {
                return new CommNotice(properties);
            };

            CommNotice.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                if (message.queue != null && $Object.hasOwnProperty.call(message, "queue"))
                    $root.easemob.pb.JID.encode(message.queue, writer.uint32(/* id 1, wireType 2 =*/10).fork(), _depth + 1).ldelim();
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            CommNotice.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            CommNotice.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end, message;
                if (length === $undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw $RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = _target || new $root.easemob.pb.CommNotice();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType !== 2)
                                break;
                            message.queue = $root.easemob.pb.JID.decode(reader, reader.size(), $undefined, _depth + 1, message.queue);
                            continue;
                        }
                    }
                    reader.skipType(wireType, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (length !== $undefined) {
                    if (reader.pos !== end)
                        throw $RangeError("index out of range");
                    reader.len = length;
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                return message;
            };

            CommNotice.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.size());
            };

            CommNotice.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                if (message.queue != null && $Object.hasOwnProperty.call(message, "queue")) {
                    let error = $root.easemob.pb.JID.verify(message.queue, _depth + 1);
                    if (error)
                        return "queue." + error;
                }
                return null;
            };

            CommNotice.fromObject = function (object, _depth) {
                if (object instanceof $root.easemob.pb.CommNotice)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".easemob.pb.CommNotice: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let message = new $root.easemob.pb.CommNotice();
                if (object.queue != null) {
                    if (!$util.isObject(object.queue))
                        throw $TypeError(".easemob.pb.CommNotice.queue: object expected");
                    message.queue = $root.easemob.pb.JID.fromObject(object.queue, _depth + 1);
                }
                return message;
            };

            CommNotice.toObject = function (message, options, _depth) {
                if (!options)
                    options = {};
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let object = {};
                if (options.defaults)
                    object.queue = null;
                if (message.queue != null && $Object.hasOwnProperty.call(message, "queue"))
                    object.queue = $root.easemob.pb.JID.toObject(message.queue, options, _depth + 1);
                return object;
            };

            CommNotice.prototype.toJSON = function() {
                return CommNotice.toObject(this, $protobuf.util.toJSONOptions);
            };

            CommNotice.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/easemob.pb.CommNotice";
            };

            return CommNotice;
        })();

        pb.CommUnreadUL = (function() {

            const CommUnreadUL = function (properties) {
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            CommUnreadUL.create = function(properties) {
                return new CommUnreadUL(properties);
            };

            CommUnreadUL.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            CommUnreadUL.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            CommUnreadUL.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end, message;
                if (length === $undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw $RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = _target || new $root.easemob.pb.CommUnreadUL();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    reader.skipType(tag & 7, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (length !== $undefined) {
                    if (reader.pos !== end)
                        throw $RangeError("index out of range");
                    reader.len = length;
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                return message;
            };

            CommUnreadUL.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.size());
            };

            CommUnreadUL.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                return null;
            };

            CommUnreadUL.fromObject = function (object, _depth) {
                if (object instanceof $root.easemob.pb.CommUnreadUL)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".easemob.pb.CommUnreadUL: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                return new $root.easemob.pb.CommUnreadUL();
            };

            CommUnreadUL.toObject = function () {
                return {};
            };

            CommUnreadUL.prototype.toJSON = function() {
                return CommUnreadUL.toObject(this, $protobuf.util.toJSONOptions);
            };

            CommUnreadUL.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/easemob.pb.CommUnreadUL";
            };

            return CommUnreadUL;
        })();

        pb.CommUnreadDL = (function() {

            const CommUnreadDL = function (properties) {
                this.unread = [];
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            CommUnreadDL.prototype.status = null;

            CommUnreadDL.prototype.unread = $util.emptyArray;

            CommUnreadDL.prototype.timestamp = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

            CommUnreadDL.create = function(properties) {
                return new CommUnreadDL(properties);
            };

            CommUnreadDL.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                if (message.status != null && $Object.hasOwnProperty.call(message, "status"))
                    $root.easemob.pb.Status.encode(message.status, writer.uint32(/* id 1, wireType 2 =*/10).fork(), _depth + 1).ldelim();
                if (message.unread != null && message.unread.length)
                    for (let i = 0; i < message.unread.length; ++i)
                        $root.easemob.pb.MetaQueue.encode(message.unread[i], writer.uint32(/* id 2, wireType 2 =*/18).fork(), _depth + 1).ldelim();
                if (message.timestamp != null && $Object.hasOwnProperty.call(message, "timestamp"))
                    writer.uint32(/* id 3, wireType 0 =*/24).uint64(message.timestamp);
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            CommUnreadDL.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            CommUnreadDL.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end, message;
                if (length === $undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw $RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = _target || new $root.easemob.pb.CommUnreadDL();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType !== 2)
                                break;
                            message.status = $root.easemob.pb.Status.decode(reader, reader.size(), $undefined, _depth + 1, message.status);
                            continue;
                        }
                    case 2: {
                            if (wireType !== 2)
                                break;
                            if (!(message.unread && message.unread.length))
                                message.unread = [];
                            message.unread.push($root.easemob.pb.MetaQueue.decode(reader, reader.size(), $undefined, _depth + 1));
                            continue;
                        }
                    case 3: {
                            if (wireType !== 0)
                                break;
                            message.timestamp = reader.uint64();
                            continue;
                        }
                    }
                    reader.skipType(wireType, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (length !== $undefined) {
                    if (reader.pos !== end)
                        throw $RangeError("index out of range");
                    reader.len = length;
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                return message;
            };

            CommUnreadDL.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.size());
            };

            CommUnreadDL.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                if (message.status != null && $Object.hasOwnProperty.call(message, "status")) {
                    let error = $root.easemob.pb.Status.verify(message.status, _depth + 1);
                    if (error)
                        return "status." + error;
                }
                if (message.unread != null && $Object.hasOwnProperty.call(message, "unread")) {
                    if (!$Array.isArray(message.unread))
                        return "unread: array expected";
                    for (let i = 0; i < message.unread.length; ++i) {
                        let error = $root.easemob.pb.MetaQueue.verify(message.unread[i], _depth + 1);
                        if (error)
                            return "unread." + error;
                    }
                }
                if (message.timestamp != null && $Object.hasOwnProperty.call(message, "timestamp"))
                    if (!$util.isInteger(message.timestamp) && !(message.timestamp && $util.isInteger(message.timestamp.low) && $util.isInteger(message.timestamp.high)))
                        return "timestamp: integer|Long expected";
                return null;
            };

            CommUnreadDL.fromObject = function (object, _depth) {
                if (object instanceof $root.easemob.pb.CommUnreadDL)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".easemob.pb.CommUnreadDL: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let message = new $root.easemob.pb.CommUnreadDL();
                if (object.status != null) {
                    if (!$util.isObject(object.status))
                        throw $TypeError(".easemob.pb.CommUnreadDL.status: object expected");
                    message.status = $root.easemob.pb.Status.fromObject(object.status, _depth + 1);
                }
                if (object.unread) {
                    if (!$Array.isArray(object.unread))
                        throw $TypeError(".easemob.pb.CommUnreadDL.unread: array expected");
                    message.unread = $Array(object.unread.length);
                    for (let i = 0; i < object.unread.length; ++i) {
                        if (!$util.isObject(object.unread[i]))
                            throw $TypeError(".easemob.pb.CommUnreadDL.unread: object expected");
                        message.unread[i] = $root.easemob.pb.MetaQueue.fromObject(object.unread[i], _depth + 1);
                    }
                }
                if (object.timestamp != null)
                    if ($util.Long)
                        message.timestamp = $util.Long.fromValue(object.timestamp, true);
                    else if (typeof object.timestamp === "string")
                        message.timestamp = $parseInt(object.timestamp, 10);
                    else if (typeof object.timestamp === "number")
                        message.timestamp = object.timestamp;
                    else if (typeof object.timestamp === "object")
                        message.timestamp = new $util.LongBits(object.timestamp.low >>> 0, object.timestamp.high >>> 0).toNumber(true);
                return message;
            };

            CommUnreadDL.toObject = function (message, options, _depth) {
                if (!options)
                    options = {};
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let object = {};
                if (options.arrays || options.defaults)
                    object.unread = [];
                if (options.defaults) {
                    object.status = null;
                    if ($util.Long) {
                        let long = new $util.Long(0, 0, true);
                        object.timestamp = options.longs === $String ? long.toString() : options.longs === $Number ? long.toNumber() : typeof $BigInt !== "undefined" && options.longs === $BigInt ? long.toBigInt() : long;
                    } else
                        object.timestamp = options.longs === $String ? "0" : typeof $BigInt !== "undefined" && options.longs === $BigInt ? $BigInt("0") : 0;
                }
                if (message.status != null && $Object.hasOwnProperty.call(message, "status"))
                    object.status = $root.easemob.pb.Status.toObject(message.status, options, _depth + 1);
                if (message.unread && message.unread.length) {
                    object.unread = $Array(message.unread.length);
                    for (let j = 0; j < message.unread.length; ++j)
                        object.unread[j] = $root.easemob.pb.MetaQueue.toObject(message.unread[j], options, _depth + 1);
                }
                if (message.timestamp != null && $Object.hasOwnProperty.call(message, "timestamp"))
                    if (typeof $BigInt !== "undefined" && options.longs === $BigInt)
                        object.timestamp = typeof message.timestamp === "number" ? $BigInt(message.timestamp) : $util.Long.fromBits(message.timestamp.low >>> 0, message.timestamp.high >>> 0, true).toBigInt();
                    else if (typeof message.timestamp === "number")
                        object.timestamp = options.longs === $String ? $String(message.timestamp) : message.timestamp;
                    else
                        object.timestamp = options.longs === $String ? $util.Long.prototype.toString.call(message.timestamp) : options.longs === $Number ? new $util.LongBits(message.timestamp.low >>> 0, message.timestamp.high >>> 0).toNumber(true) : message.timestamp;
                return object;
            };

            CommUnreadDL.prototype.toJSON = function() {
                return CommUnreadDL.toObject(this, $protobuf.util.toJSONOptions);
            };

            CommUnreadDL.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/easemob.pb.CommUnreadDL";
            };

            return CommUnreadDL;
        })();

        pb.MetaQueue = (function() {

            const MetaQueue = function (properties) {
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            MetaQueue.prototype.queue = null;

            MetaQueue.prototype.n = 0;

            MetaQueue.create = function(properties) {
                return new MetaQueue(properties);
            };

            MetaQueue.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                if (message.queue != null && $Object.hasOwnProperty.call(message, "queue"))
                    $root.easemob.pb.JID.encode(message.queue, writer.uint32(/* id 1, wireType 2 =*/10).fork(), _depth + 1).ldelim();
                if (message.n != null && $Object.hasOwnProperty.call(message, "n"))
                    writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.n);
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            MetaQueue.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            MetaQueue.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end, message;
                if (length === $undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw $RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = _target || new $root.easemob.pb.MetaQueue();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType !== 2)
                                break;
                            message.queue = $root.easemob.pb.JID.decode(reader, reader.size(), $undefined, _depth + 1, message.queue);
                            continue;
                        }
                    case 2: {
                            if (wireType !== 0)
                                break;
                            message.n = reader.uint32();
                            continue;
                        }
                    }
                    reader.skipType(wireType, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (length !== $undefined) {
                    if (reader.pos !== end)
                        throw $RangeError("index out of range");
                    reader.len = length;
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                return message;
            };

            MetaQueue.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.size());
            };

            MetaQueue.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                if (message.queue != null && $Object.hasOwnProperty.call(message, "queue")) {
                    let error = $root.easemob.pb.JID.verify(message.queue, _depth + 1);
                    if (error)
                        return "queue." + error;
                }
                if (message.n != null && $Object.hasOwnProperty.call(message, "n"))
                    if (!$util.isInteger(message.n))
                        return "n: integer expected";
                return null;
            };

            MetaQueue.fromObject = function (object, _depth) {
                if (object instanceof $root.easemob.pb.MetaQueue)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".easemob.pb.MetaQueue: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let message = new $root.easemob.pb.MetaQueue();
                if (object.queue != null) {
                    if (!$util.isObject(object.queue))
                        throw $TypeError(".easemob.pb.MetaQueue.queue: object expected");
                    message.queue = $root.easemob.pb.JID.fromObject(object.queue, _depth + 1);
                }
                if (object.n != null)
                    message.n = object.n >>> 0;
                return message;
            };

            MetaQueue.toObject = function (message, options, _depth) {
                if (!options)
                    options = {};
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let object = {};
                if (options.defaults) {
                    object.queue = null;
                    object.n = 0;
                }
                if (message.queue != null && $Object.hasOwnProperty.call(message, "queue"))
                    object.queue = $root.easemob.pb.JID.toObject(message.queue, options, _depth + 1);
                if (message.n != null && $Object.hasOwnProperty.call(message, "n"))
                    object.n = message.n;
                return object;
            };

            MetaQueue.prototype.toJSON = function() {
                return MetaQueue.toObject(this, $protobuf.util.toJSONOptions);
            };

            MetaQueue.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/easemob.pb.MetaQueue";
            };

            return MetaQueue;
        })();

        pb.Meta = (function() {

            const Meta = function (properties) {
                this.ext = [];
                this.directedUsers = [];
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            Meta.prototype.id = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

            Meta.prototype.from = null;

            Meta.prototype.to = null;

            Meta.prototype.timestamp = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

            Meta.prototype.ns = 0;

            Meta.prototype.payload = $util.newBuffer([]);

            Meta.prototype.routetype = 0;

            Meta.prototype.ext = $util.emptyArray;

            Meta.prototype.meta = $util.newBuffer([]);

            Meta.prototype.directedUsers = $util.emptyArray;

            Meta.create = function(properties) {
                return new Meta(properties);
            };

            Meta.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                if (message.id != null && $Object.hasOwnProperty.call(message, "id"))
                    writer.uint32(/* id 1, wireType 0 =*/8).uint64(message.id);
                if (message.from != null && $Object.hasOwnProperty.call(message, "from"))
                    $root.easemob.pb.JID.encode(message.from, writer.uint32(/* id 2, wireType 2 =*/18).fork(), _depth + 1).ldelim();
                if (message.to != null && $Object.hasOwnProperty.call(message, "to"))
                    $root.easemob.pb.JID.encode(message.to, writer.uint32(/* id 3, wireType 2 =*/26).fork(), _depth + 1).ldelim();
                if (message.timestamp != null && $Object.hasOwnProperty.call(message, "timestamp"))
                    writer.uint32(/* id 4, wireType 0 =*/32).uint64(message.timestamp);
                if (message.ns != null && $Object.hasOwnProperty.call(message, "ns"))
                    writer.uint32(/* id 5, wireType 0 =*/40).int32(message.ns);
                if (message.payload != null && $Object.hasOwnProperty.call(message, "payload"))
                    writer.uint32(/* id 6, wireType 2 =*/50).bytes(message.payload);
                if (message.routetype != null && $Object.hasOwnProperty.call(message, "routetype"))
                    writer.uint32(/* id 7, wireType 0 =*/56).int32(message.routetype);
                if (message.ext != null && message.ext.length)
                    for (let i = 0; i < message.ext.length; ++i)
                        $root.easemob.pb.KeyValue.encode(message.ext[i], writer.uint32(/* id 8, wireType 2 =*/66).fork(), _depth + 1).ldelim();
                if (message.meta != null && $Object.hasOwnProperty.call(message, "meta"))
                    writer.uint32(/* id 9, wireType 2 =*/74).bytes(message.meta);
                if (message.directedUsers != null && message.directedUsers.length)
                    for (let i = 0; i < message.directedUsers.length; ++i)
                        writer.uint32(/* id 10, wireType 2 =*/82).string(message.directedUsers[i]);
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            Meta.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            Meta.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end, message, value;
                if (length === $undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw $RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = _target || new $root.easemob.pb.Meta();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType !== 0)
                                break;
                            message.id = reader.uint64();
                            continue;
                        }
                    case 2: {
                            if (wireType !== 2)
                                break;
                            message.from = $root.easemob.pb.JID.decode(reader, reader.size(), $undefined, _depth + 1, message.from);
                            continue;
                        }
                    case 3: {
                            if (wireType !== 2)
                                break;
                            message.to = $root.easemob.pb.JID.decode(reader, reader.size(), $undefined, _depth + 1, message.to);
                            continue;
                        }
                    case 4: {
                            if (wireType !== 0)
                                break;
                            message.timestamp = reader.uint64();
                            continue;
                        }
                    case 5: {
                            if (wireType !== 0)
                                break;
                            value = reader.int32();
                            if ($root.easemob.pb.Meta.NameSpace[value] !== $undefined)
                                message.ns = value;
                            else if (!reader.discardUnknown) {
                                $util.makeProp(message, "$unknowns", false);
                                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                            }
                            continue;
                        }
                    case 6: {
                            if (wireType !== 2)
                                break;
                            message.payload = reader.bytes();
                            continue;
                        }
                    case 7: {
                            if (wireType !== 0)
                                break;
                            value = reader.int32();
                            if ($root.easemob.pb.Meta.RouteType[value] !== $undefined)
                                message.routetype = value;
                            else if (!reader.discardUnknown) {
                                $util.makeProp(message, "$unknowns", false);
                                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                            }
                            continue;
                        }
                    case 8: {
                            if (wireType !== 2)
                                break;
                            if (!(message.ext && message.ext.length))
                                message.ext = [];
                            message.ext.push($root.easemob.pb.KeyValue.decode(reader, reader.size(), $undefined, _depth + 1));
                            continue;
                        }
                    case 9: {
                            if (wireType !== 2)
                                break;
                            message.meta = reader.bytes();
                            continue;
                        }
                    case 10: {
                            if (wireType !== 2)
                                break;
                            if (!(message.directedUsers && message.directedUsers.length))
                                message.directedUsers = [];
                            message.directedUsers.push(reader.string());
                            continue;
                        }
                    }
                    reader.skipType(wireType, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (length !== $undefined) {
                    if (reader.pos !== end)
                        throw $RangeError("index out of range");
                    reader.len = length;
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                return message;
            };

            Meta.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.size());
            };

            Meta.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                if (message.id != null && $Object.hasOwnProperty.call(message, "id"))
                    if (!$util.isInteger(message.id) && !(message.id && $util.isInteger(message.id.low) && $util.isInteger(message.id.high)))
                        return "id: integer|Long expected";
                if (message.from != null && $Object.hasOwnProperty.call(message, "from")) {
                    let error = $root.easemob.pb.JID.verify(message.from, _depth + 1);
                    if (error)
                        return "from." + error;
                }
                if (message.to != null && $Object.hasOwnProperty.call(message, "to")) {
                    let error = $root.easemob.pb.JID.verify(message.to, _depth + 1);
                    if (error)
                        return "to." + error;
                }
                if (message.timestamp != null && $Object.hasOwnProperty.call(message, "timestamp"))
                    if (!$util.isInteger(message.timestamp) && !(message.timestamp && $util.isInteger(message.timestamp.low) && $util.isInteger(message.timestamp.high)))
                        return "timestamp: integer|Long expected";
                if (message.ns != null && $Object.hasOwnProperty.call(message, "ns"))
                    switch (message.ns) {
                    default:
                        return "ns: enum value expected";
                    case 0:
                    case 1:
                    case 2:
                    case 3:
                    case 4:
                    case 5:
                    case 6:
                        break;
                    }
                if (message.payload != null && $Object.hasOwnProperty.call(message, "payload"))
                    if (!(message.payload && typeof message.payload.length === "number" || $util.isString(message.payload)))
                        return "payload: buffer expected";
                if (message.routetype != null && $Object.hasOwnProperty.call(message, "routetype"))
                    switch (message.routetype) {
                    default:
                        return "routetype: enum value expected";
                    case 0:
                    case 1:
                    case 2:
                        break;
                    }
                if (message.ext != null && $Object.hasOwnProperty.call(message, "ext")) {
                    if (!$Array.isArray(message.ext))
                        return "ext: array expected";
                    for (let i = 0; i < message.ext.length; ++i) {
                        let error = $root.easemob.pb.KeyValue.verify(message.ext[i], _depth + 1);
                        if (error)
                            return "ext." + error;
                    }
                }
                if (message.meta != null && $Object.hasOwnProperty.call(message, "meta"))
                    if (!(message.meta && typeof message.meta.length === "number" || $util.isString(message.meta)))
                        return "meta: buffer expected";
                if (message.directedUsers != null && $Object.hasOwnProperty.call(message, "directedUsers")) {
                    if (!$Array.isArray(message.directedUsers))
                        return "directedUsers: array expected";
                    for (let i = 0; i < message.directedUsers.length; ++i)
                        if (!$util.isString(message.directedUsers[i]))
                            return "directedUsers: string[] expected";
                }
                return null;
            };

            Meta.fromObject = function (object, _depth) {
                if (object instanceof $root.easemob.pb.Meta)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".easemob.pb.Meta: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let message = new $root.easemob.pb.Meta();
                if (object.id != null)
                    if ($util.Long)
                        message.id = $util.Long.fromValue(object.id, true);
                    else if (typeof object.id === "string")
                        message.id = $parseInt(object.id, 10);
                    else if (typeof object.id === "number")
                        message.id = object.id;
                    else if (typeof object.id === "object")
                        message.id = new $util.LongBits(object.id.low >>> 0, object.id.high >>> 0).toNumber(true);
                if (object.from != null) {
                    if (!$util.isObject(object.from))
                        throw $TypeError(".easemob.pb.Meta.from: object expected");
                    message.from = $root.easemob.pb.JID.fromObject(object.from, _depth + 1);
                }
                if (object.to != null) {
                    if (!$util.isObject(object.to))
                        throw $TypeError(".easemob.pb.Meta.to: object expected");
                    message.to = $root.easemob.pb.JID.fromObject(object.to, _depth + 1);
                }
                if (object.timestamp != null)
                    if ($util.Long)
                        message.timestamp = $util.Long.fromValue(object.timestamp, true);
                    else if (typeof object.timestamp === "string")
                        message.timestamp = $parseInt(object.timestamp, 10);
                    else if (typeof object.timestamp === "number")
                        message.timestamp = object.timestamp;
                    else if (typeof object.timestamp === "object")
                        message.timestamp = new $util.LongBits(object.timestamp.low >>> 0, object.timestamp.high >>> 0).toNumber(true);
                switch (object.ns) {
                case "STATISTIC":
                case 0:
                    message.ns = 0;
                    break;
                case "CHAT":
                case 1:
                    message.ns = 1;
                    break;
                case "MUC":
                case 2:
                    message.ns = 2;
                    break;
                case "ROSTER":
                case 3:
                    message.ns = 3;
                    break;
                case "CONFERENCE":
                case 4:
                    message.ns = 4;
                    break;
                case "NOTIFY":
                case 5:
                    message.ns = 5;
                    break;
                case "QUERY":
                case 6:
                    message.ns = 6;
                    break;
                default:
                }
                if (object.payload != null)
                    if (typeof object.payload === "string")
                        $util.base64.decode(object.payload, message.payload = $util.newBuffer($util.base64.length(object.payload)), 0);
                    else if (object.payload.length >= 0)
                        message.payload = object.payload;
                switch (object.routetype) {
                case "ROUTE_ALL":
                case 0:
                    message.routetype = 0;
                    break;
                case "ROUTE_ONLINE":
                case 1:
                    message.routetype = 1;
                    break;
                case "ROUTE_DIRECT":
                case 2:
                    message.routetype = 2;
                    break;
                default:
                }
                if (object.ext) {
                    if (!$Array.isArray(object.ext))
                        throw $TypeError(".easemob.pb.Meta.ext: array expected");
                    message.ext = $Array(object.ext.length);
                    for (let i = 0; i < object.ext.length; ++i) {
                        if (!$util.isObject(object.ext[i]))
                            throw $TypeError(".easemob.pb.Meta.ext: object expected");
                        message.ext[i] = $root.easemob.pb.KeyValue.fromObject(object.ext[i], _depth + 1);
                    }
                }
                if (object.meta != null)
                    if (typeof object.meta === "string")
                        $util.base64.decode(object.meta, message.meta = $util.newBuffer($util.base64.length(object.meta)), 0);
                    else if (object.meta.length >= 0)
                        message.meta = object.meta;
                if (object.directedUsers) {
                    if (!$Array.isArray(object.directedUsers))
                        throw $TypeError(".easemob.pb.Meta.directedUsers: array expected");
                    message.directedUsers = $Array(object.directedUsers.length);
                    for (let i = 0; i < object.directedUsers.length; ++i)
                        message.directedUsers[i] = $String(object.directedUsers[i]);
                }
                return message;
            };

            Meta.toObject = function (message, options, _depth) {
                if (!options)
                    options = {};
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let object = {};
                if (options.arrays || options.defaults) {
                    object.ext = [];
                    object.directedUsers = [];
                }
                if (options.defaults) {
                    if ($util.Long) {
                        let long = new $util.Long(0, 0, true);
                        object.id = options.longs === $String ? long.toString() : options.longs === $Number ? long.toNumber() : typeof $BigInt !== "undefined" && options.longs === $BigInt ? long.toBigInt() : long;
                    } else
                        object.id = options.longs === $String ? "0" : typeof $BigInt !== "undefined" && options.longs === $BigInt ? $BigInt("0") : 0;
                    object.from = null;
                    object.to = null;
                    if ($util.Long) {
                        let long = new $util.Long(0, 0, true);
                        object.timestamp = options.longs === $String ? long.toString() : options.longs === $Number ? long.toNumber() : typeof $BigInt !== "undefined" && options.longs === $BigInt ? long.toBigInt() : long;
                    } else
                        object.timestamp = options.longs === $String ? "0" : typeof $BigInt !== "undefined" && options.longs === $BigInt ? $BigInt("0") : 0;
                    object.ns = options.enums === $String ? "STATISTIC" : 0;
                    if (options.bytes === $String)
                        object.payload = "";
                    else {
                        object.payload = [];
                        if (options.bytes !== $Array)
                            object.payload = $util.newBuffer(object.payload);
                    }
                    object.routetype = options.enums === $String ? "ROUTE_ALL" : 0;
                    if (options.bytes === $String)
                        object.meta = "";
                    else {
                        object.meta = [];
                        if (options.bytes !== $Array)
                            object.meta = $util.newBuffer(object.meta);
                    }
                }
                if (message.id != null && $Object.hasOwnProperty.call(message, "id"))
                    if (typeof $BigInt !== "undefined" && options.longs === $BigInt)
                        object.id = typeof message.id === "number" ? $BigInt(message.id) : $util.Long.fromBits(message.id.low >>> 0, message.id.high >>> 0, true).toBigInt();
                    else if (typeof message.id === "number")
                        object.id = options.longs === $String ? $String(message.id) : message.id;
                    else
                        object.id = options.longs === $String ? $util.Long.prototype.toString.call(message.id) : options.longs === $Number ? new $util.LongBits(message.id.low >>> 0, message.id.high >>> 0).toNumber(true) : message.id;
                if (message.from != null && $Object.hasOwnProperty.call(message, "from"))
                    object.from = $root.easemob.pb.JID.toObject(message.from, options, _depth + 1);
                if (message.to != null && $Object.hasOwnProperty.call(message, "to"))
                    object.to = $root.easemob.pb.JID.toObject(message.to, options, _depth + 1);
                if (message.timestamp != null && $Object.hasOwnProperty.call(message, "timestamp"))
                    if (typeof $BigInt !== "undefined" && options.longs === $BigInt)
                        object.timestamp = typeof message.timestamp === "number" ? $BigInt(message.timestamp) : $util.Long.fromBits(message.timestamp.low >>> 0, message.timestamp.high >>> 0, true).toBigInt();
                    else if (typeof message.timestamp === "number")
                        object.timestamp = options.longs === $String ? $String(message.timestamp) : message.timestamp;
                    else
                        object.timestamp = options.longs === $String ? $util.Long.prototype.toString.call(message.timestamp) : options.longs === $Number ? new $util.LongBits(message.timestamp.low >>> 0, message.timestamp.high >>> 0).toNumber(true) : message.timestamp;
                if (message.ns != null && $Object.hasOwnProperty.call(message, "ns"))
                    object.ns = options.enums === $String ? $root.easemob.pb.Meta.NameSpace[message.ns] === $undefined ? message.ns : $root.easemob.pb.Meta.NameSpace[message.ns] : message.ns;
                if (message.payload != null && $Object.hasOwnProperty.call(message, "payload"))
                    object.payload = options.bytes === $String ? $util.base64.encode(message.payload, 0, message.payload.length) : options.bytes === $Array ? $Array.prototype.slice.call(message.payload) : message.payload;
                if (message.routetype != null && $Object.hasOwnProperty.call(message, "routetype"))
                    object.routetype = options.enums === $String ? $root.easemob.pb.Meta.RouteType[message.routetype] === $undefined ? message.routetype : $root.easemob.pb.Meta.RouteType[message.routetype] : message.routetype;
                if (message.ext && message.ext.length) {
                    object.ext = $Array(message.ext.length);
                    for (let j = 0; j < message.ext.length; ++j)
                        object.ext[j] = $root.easemob.pb.KeyValue.toObject(message.ext[j], options, _depth + 1);
                }
                if (message.meta != null && $Object.hasOwnProperty.call(message, "meta"))
                    object.meta = options.bytes === $String ? $util.base64.encode(message.meta, 0, message.meta.length) : options.bytes === $Array ? $Array.prototype.slice.call(message.meta) : message.meta;
                if (message.directedUsers && message.directedUsers.length) {
                    object.directedUsers = $Array(message.directedUsers.length);
                    for (let j = 0; j < message.directedUsers.length; ++j)
                        object.directedUsers[j] = message.directedUsers[j];
                }
                return object;
            };

            Meta.prototype.toJSON = function() {
                return Meta.toObject(this, $protobuf.util.toJSONOptions);
            };

            Meta.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/easemob.pb.Meta";
            };

            Meta.NameSpace = (function() {
                const valuesById = $Object.create(null), values = $Object.create(valuesById);
                values[valuesById[0] = "STATISTIC"] = 0;
                values[valuesById[1] = "CHAT"] = 1;
                values[valuesById[2] = "MUC"] = 2;
                values[valuesById[3] = "ROSTER"] = 3;
                values[valuesById[4] = "CONFERENCE"] = 4;
                values[valuesById[5] = "NOTIFY"] = 5;
                values[valuesById[6] = "QUERY"] = 6;
                return values;
            })();

            Meta.RouteType = (function() {
                const valuesById = $Object.create(null), values = $Object.create(valuesById);
                values[valuesById[0] = "ROUTE_ALL"] = 0;
                values[valuesById[1] = "ROUTE_ONLINE"] = 1;
                values[valuesById[2] = "ROUTE_DIRECT"] = 2;
                return values;
            })();

            return Meta;
        })();

        pb.Status = (function() {

            const Status = function (properties) {
                this.redirectInfo = [];
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            Status.prototype.errorCode = 0;

            Status.prototype.reason = "";

            Status.prototype.redirectInfo = $util.emptyArray;

            Status.create = function(properties) {
                return new Status(properties);
            };

            Status.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                if (message.errorCode != null && $Object.hasOwnProperty.call(message, "errorCode"))
                    writer.uint32(/* id 1, wireType 0 =*/8).int32(message.errorCode);
                if (message.reason != null && $Object.hasOwnProperty.call(message, "reason"))
                    writer.uint32(/* id 2, wireType 2 =*/18).string(message.reason);
                if (message.redirectInfo != null && message.redirectInfo.length)
                    for (let i = 0; i < message.redirectInfo.length; ++i)
                        $root.easemob.pb.RedirectInfo.encode(message.redirectInfo[i], writer.uint32(/* id 3, wireType 2 =*/26).fork(), _depth + 1).ldelim();
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            Status.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            Status.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end, message, value;
                if (length === $undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw $RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = _target || new $root.easemob.pb.Status();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType !== 0)
                                break;
                            value = reader.int32();
                            if ($root.easemob.pb.Status.ErrorCode[value] !== $undefined)
                                message.errorCode = value;
                            else if (!reader.discardUnknown) {
                                $util.makeProp(message, "$unknowns", false);
                                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                            }
                            continue;
                        }
                    case 2: {
                            if (wireType !== 2)
                                break;
                            message.reason = reader.string();
                            continue;
                        }
                    case 3: {
                            if (wireType !== 2)
                                break;
                            if (!(message.redirectInfo && message.redirectInfo.length))
                                message.redirectInfo = [];
                            message.redirectInfo.push($root.easemob.pb.RedirectInfo.decode(reader, reader.size(), $undefined, _depth + 1));
                            continue;
                        }
                    }
                    reader.skipType(wireType, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (length !== $undefined) {
                    if (reader.pos !== end)
                        throw $RangeError("index out of range");
                    reader.len = length;
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                return message;
            };

            Status.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.size());
            };

            Status.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                if (message.errorCode != null && $Object.hasOwnProperty.call(message, "errorCode"))
                    switch (message.errorCode) {
                    default:
                        return "errorCode: enum value expected";
                    case 0:
                    case 1:
                    case 2:
                    case 3:
                    case 4:
                    case 5:
                    case 6:
                    case 7:
                    case 8:
                    case 9:
                    case 10:
                    case 11:
                    case 12:
                    case 13:
                    case 14:
                    case 15:
                    case 16:
                    case 17:
                    case 18:
                    case 19:
                        break;
                    }
                if (message.reason != null && $Object.hasOwnProperty.call(message, "reason"))
                    if (!$util.isString(message.reason))
                        return "reason: string expected";
                if (message.redirectInfo != null && $Object.hasOwnProperty.call(message, "redirectInfo")) {
                    if (!$Array.isArray(message.redirectInfo))
                        return "redirectInfo: array expected";
                    for (let i = 0; i < message.redirectInfo.length; ++i) {
                        let error = $root.easemob.pb.RedirectInfo.verify(message.redirectInfo[i], _depth + 1);
                        if (error)
                            return "redirectInfo." + error;
                    }
                }
                return null;
            };

            Status.fromObject = function (object, _depth) {
                if (object instanceof $root.easemob.pb.Status)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".easemob.pb.Status: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let message = new $root.easemob.pb.Status();
                switch (object.errorCode) {
                case "OK":
                case 0:
                    message.errorCode = 0;
                    break;
                case "FAIL":
                case 1:
                    message.errorCode = 1;
                    break;
                case "UNAUTHORIZED":
                case 2:
                    message.errorCode = 2;
                    break;
                case "MISSING_PARAMETER":
                case 3:
                    message.errorCode = 3;
                    break;
                case "WRONG_PARAMETER":
                case 4:
                    message.errorCode = 4;
                    break;
                case "REDIRECT":
                case 5:
                    message.errorCode = 5;
                    break;
                case "TOKEN_EXPIRED":
                case 6:
                    message.errorCode = 6;
                    break;
                case "PERMISSION_DENIED":
                case 7:
                    message.errorCode = 7;
                    break;
                case "NO_ROUTE":
                case 8:
                    message.errorCode = 8;
                    break;
                case "UNKNOWN_COMMAND":
                case 9:
                    message.errorCode = 9;
                    break;
                case "PB_PARSER_ERROR":
                case 10:
                    message.errorCode = 10;
                    break;
                case "BIND_ANOTHER_DEVICE":
                case 11:
                    message.errorCode = 11;
                    break;
                case "IM_FORBIDDEN":
                case 12:
                    message.errorCode = 12;
                    break;
                case "TOO_MANY_DEVICES":
                case 13:
                    message.errorCode = 13;
                    break;
                case "PLATFORM_LIMIT":
                case 14:
                    message.errorCode = 14;
                    break;
                case "USER_MUTED":
                case 15:
                    message.errorCode = 15;
                    break;
                case "ENCRYPT_DISABLE":
                case 16:
                    message.errorCode = 16;
                    break;
                case "ENCRYPT_ENABLE":
                case 17:
                    message.errorCode = 17;
                    break;
                case "DECRYPT_FAILURE":
                case 18:
                    message.errorCode = 18;
                    break;
                case "PERMISSION_DENIED_EXTERNAL":
                case 19:
                    message.errorCode = 19;
                    break;
                default:
                }
                if (object.reason != null)
                    message.reason = $String(object.reason);
                if (object.redirectInfo) {
                    if (!$Array.isArray(object.redirectInfo))
                        throw $TypeError(".easemob.pb.Status.redirectInfo: array expected");
                    message.redirectInfo = $Array(object.redirectInfo.length);
                    for (let i = 0; i < object.redirectInfo.length; ++i) {
                        if (!$util.isObject(object.redirectInfo[i]))
                            throw $TypeError(".easemob.pb.Status.redirectInfo: object expected");
                        message.redirectInfo[i] = $root.easemob.pb.RedirectInfo.fromObject(object.redirectInfo[i], _depth + 1);
                    }
                }
                return message;
            };

            Status.toObject = function (message, options, _depth) {
                if (!options)
                    options = {};
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let object = {};
                if (options.arrays || options.defaults)
                    object.redirectInfo = [];
                if (options.defaults) {
                    object.errorCode = options.enums === $String ? "OK" : 0;
                    object.reason = "";
                }
                if (message.errorCode != null && $Object.hasOwnProperty.call(message, "errorCode"))
                    object.errorCode = options.enums === $String ? $root.easemob.pb.Status.ErrorCode[message.errorCode] === $undefined ? message.errorCode : $root.easemob.pb.Status.ErrorCode[message.errorCode] : message.errorCode;
                if (message.reason != null && $Object.hasOwnProperty.call(message, "reason"))
                    object.reason = message.reason;
                if (message.redirectInfo && message.redirectInfo.length) {
                    object.redirectInfo = $Array(message.redirectInfo.length);
                    for (let j = 0; j < message.redirectInfo.length; ++j)
                        object.redirectInfo[j] = $root.easemob.pb.RedirectInfo.toObject(message.redirectInfo[j], options, _depth + 1);
                }
                return object;
            };

            Status.prototype.toJSON = function() {
                return Status.toObject(this, $protobuf.util.toJSONOptions);
            };

            Status.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/easemob.pb.Status";
            };

            Status.ErrorCode = (function() {
                const valuesById = $Object.create(null), values = $Object.create(valuesById);
                values[valuesById[0] = "OK"] = 0;
                values[valuesById[1] = "FAIL"] = 1;
                values[valuesById[2] = "UNAUTHORIZED"] = 2;
                values[valuesById[3] = "MISSING_PARAMETER"] = 3;
                values[valuesById[4] = "WRONG_PARAMETER"] = 4;
                values[valuesById[5] = "REDIRECT"] = 5;
                values[valuesById[6] = "TOKEN_EXPIRED"] = 6;
                values[valuesById[7] = "PERMISSION_DENIED"] = 7;
                values[valuesById[8] = "NO_ROUTE"] = 8;
                values[valuesById[9] = "UNKNOWN_COMMAND"] = 9;
                values[valuesById[10] = "PB_PARSER_ERROR"] = 10;
                values[valuesById[11] = "BIND_ANOTHER_DEVICE"] = 11;
                values[valuesById[12] = "IM_FORBIDDEN"] = 12;
                values[valuesById[13] = "TOO_MANY_DEVICES"] = 13;
                values[valuesById[14] = "PLATFORM_LIMIT"] = 14;
                values[valuesById[15] = "USER_MUTED"] = 15;
                values[valuesById[16] = "ENCRYPT_DISABLE"] = 16;
                values[valuesById[17] = "ENCRYPT_ENABLE"] = 17;
                values[valuesById[18] = "DECRYPT_FAILURE"] = 18;
                values[valuesById[19] = "PERMISSION_DENIED_EXTERNAL"] = 19;
                return values;
            })();

            return Status;
        })();

        pb.RedirectInfo = (function() {

            const RedirectInfo = function (properties) {
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            RedirectInfo.prototype.host = "";

            RedirectInfo.prototype.port = 0;

            RedirectInfo.create = function(properties) {
                return new RedirectInfo(properties);
            };

            RedirectInfo.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                if (message.host != null && $Object.hasOwnProperty.call(message, "host"))
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.host);
                if (message.port != null && $Object.hasOwnProperty.call(message, "port"))
                    writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.port);
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            RedirectInfo.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            RedirectInfo.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end, message;
                if (length === $undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw $RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = _target || new $root.easemob.pb.RedirectInfo();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType !== 2)
                                break;
                            message.host = reader.string();
                            continue;
                        }
                    case 2: {
                            if (wireType !== 0)
                                break;
                            message.port = reader.uint32();
                            continue;
                        }
                    }
                    reader.skipType(wireType, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (length !== $undefined) {
                    if (reader.pos !== end)
                        throw $RangeError("index out of range");
                    reader.len = length;
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                return message;
            };

            RedirectInfo.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.size());
            };

            RedirectInfo.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                if (message.host != null && $Object.hasOwnProperty.call(message, "host"))
                    if (!$util.isString(message.host))
                        return "host: string expected";
                if (message.port != null && $Object.hasOwnProperty.call(message, "port"))
                    if (!$util.isInteger(message.port))
                        return "port: integer expected";
                return null;
            };

            RedirectInfo.fromObject = function (object, _depth) {
                if (object instanceof $root.easemob.pb.RedirectInfo)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".easemob.pb.RedirectInfo: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let message = new $root.easemob.pb.RedirectInfo();
                if (object.host != null)
                    message.host = $String(object.host);
                if (object.port != null)
                    message.port = object.port >>> 0;
                return message;
            };

            RedirectInfo.toObject = function (message, options, _depth) {
                if (!options)
                    options = {};
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let object = {};
                if (options.defaults) {
                    object.host = "";
                    object.port = 0;
                }
                if (message.host != null && $Object.hasOwnProperty.call(message, "host"))
                    object.host = message.host;
                if (message.port != null && $Object.hasOwnProperty.call(message, "port"))
                    object.port = message.port;
                return object;
            };

            RedirectInfo.prototype.toJSON = function() {
                return RedirectInfo.toObject(this, $protobuf.util.toJSONOptions);
            };

            RedirectInfo.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/easemob.pb.RedirectInfo";
            };

            return RedirectInfo;
        })();

        pb.Provision = (function() {

            const Provision = function (properties) {
                this.compressType = [];
                this.encryptType = [];
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            Provision.prototype.osType = 0;

            Provision.prototype.version = "";

            Provision.prototype.networkType = 0;

            Provision.prototype.appSign = "";

            Provision.prototype.compressType = $util.emptyArray;

            Provision.prototype.encryptType = $util.emptyArray;

            Provision.prototype.encryptKey = "";

            Provision.prototype.status = null;

            Provision.prototype.deviceUuid = "";

            Provision.prototype.isManualLogin = false;

            Provision.prototype.password = "";

            Provision.prototype.deviceName = "";

            Provision.prototype.resource = "";

            Provision.prototype.auth = "";

            Provision.prototype.serviceId = "";

            Provision.prototype.actionVersion = "";

            Provision.prototype.authToken = "";

            Provision.prototype.osCustomValue = 0;

            Provision.prototype.sessionId = "";

            Provision.prototype.reason = "";

            Provision.create = function(properties) {
                return new Provision(properties);
            };

            Provision.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                if (message.osType != null && $Object.hasOwnProperty.call(message, "osType"))
                    writer.uint32(/* id 1, wireType 0 =*/8).int32(message.osType);
                if (message.version != null && $Object.hasOwnProperty.call(message, "version"))
                    writer.uint32(/* id 2, wireType 2 =*/18).string(message.version);
                if (message.networkType != null && $Object.hasOwnProperty.call(message, "networkType"))
                    writer.uint32(/* id 3, wireType 0 =*/24).int32(message.networkType);
                if (message.appSign != null && $Object.hasOwnProperty.call(message, "appSign"))
                    writer.uint32(/* id 4, wireType 2 =*/34).string(message.appSign);
                if (message.compressType != null && message.compressType.length)
                    for (let i = 0; i < message.compressType.length; ++i)
                        writer.uint32(/* id 5, wireType 0 =*/40).int32(message.compressType[i]);
                if (message.encryptType != null && message.encryptType.length)
                    for (let i = 0; i < message.encryptType.length; ++i)
                        writer.uint32(/* id 6, wireType 0 =*/48).int32(message.encryptType[i]);
                if (message.encryptKey != null && $Object.hasOwnProperty.call(message, "encryptKey"))
                    writer.uint32(/* id 7, wireType 2 =*/58).string(message.encryptKey);
                if (message.status != null && $Object.hasOwnProperty.call(message, "status"))
                    $root.easemob.pb.Status.encode(message.status, writer.uint32(/* id 8, wireType 2 =*/66).fork(), _depth + 1).ldelim();
                if (message.deviceUuid != null && $Object.hasOwnProperty.call(message, "deviceUuid"))
                    writer.uint32(/* id 9, wireType 2 =*/74).string(message.deviceUuid);
                if (message.isManualLogin != null && $Object.hasOwnProperty.call(message, "isManualLogin"))
                    writer.uint32(/* id 10, wireType 0 =*/80).bool(message.isManualLogin);
                if (message.password != null && $Object.hasOwnProperty.call(message, "password"))
                    writer.uint32(/* id 11, wireType 2 =*/90).string(message.password);
                if (message.deviceName != null && $Object.hasOwnProperty.call(message, "deviceName"))
                    writer.uint32(/* id 12, wireType 2 =*/98).string(message.deviceName);
                if (message.resource != null && $Object.hasOwnProperty.call(message, "resource"))
                    writer.uint32(/* id 13, wireType 2 =*/106).string(message.resource);
                if (message.auth != null && $Object.hasOwnProperty.call(message, "auth"))
                    writer.uint32(/* id 14, wireType 2 =*/114).string(message.auth);
                if (message.serviceId != null && $Object.hasOwnProperty.call(message, "serviceId"))
                    writer.uint32(/* id 16, wireType 2 =*/130).string(message.serviceId);
                if (message.actionVersion != null && $Object.hasOwnProperty.call(message, "actionVersion"))
                    writer.uint32(/* id 17, wireType 2 =*/138).string(message.actionVersion);
                if (message.authToken != null && $Object.hasOwnProperty.call(message, "authToken"))
                    writer.uint32(/* id 18, wireType 2 =*/146).string(message.authToken);
                if (message.osCustomValue != null && $Object.hasOwnProperty.call(message, "osCustomValue"))
                    writer.uint32(/* id 19, wireType 0 =*/152).uint32(message.osCustomValue);
                if (message.sessionId != null && $Object.hasOwnProperty.call(message, "sessionId"))
                    writer.uint32(/* id 20, wireType 2 =*/162).string(message.sessionId);
                if (message.reason != null && $Object.hasOwnProperty.call(message, "reason"))
                    writer.uint32(/* id 21, wireType 2 =*/170).string(message.reason);
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            Provision.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            Provision.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end, message, value;
                if (length === $undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw $RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = _target || new $root.easemob.pb.Provision();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType !== 0)
                                break;
                            value = reader.int32();
                            if ($root.easemob.pb.Provision.OsType[value] !== $undefined)
                                message.osType = value;
                            else if (!reader.discardUnknown) {
                                $util.makeProp(message, "$unknowns", false);
                                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                            }
                            continue;
                        }
                    case 2: {
                            if (wireType !== 2)
                                break;
                            message.version = reader.string();
                            continue;
                        }
                    case 3: {
                            if (wireType !== 0)
                                break;
                            value = reader.int32();
                            if ($root.easemob.pb.Provision.NetworkType[value] !== $undefined)
                                message.networkType = value;
                            else if (!reader.discardUnknown) {
                                $util.makeProp(message, "$unknowns", false);
                                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                            }
                            continue;
                        }
                    case 4: {
                            if (wireType !== 2)
                                break;
                            message.appSign = reader.string();
                            continue;
                        }
                    case 5: {
                            if (wireType === 2) {
                                let end2 = reader.size() + reader.pos;
                                if (end2 > reader.len)
                                    throw $RangeError("index out of range");
                                reader.len = end2;
                                while (reader.pos < end2) {
                                    start = reader.pos;
                                    value = reader.int32();
                                    if ($root.easemob.pb.Provision.CompressType[value] !== $undefined) {
                                        if (!(message.compressType && message.compressType.length))
                                            message.compressType = [];
                                        message.compressType.push(value);
                                    } else if (!reader.discardUnknown) {
                                        $util.makeProp(message, "$unknowns", false);
                                        (message.$unknowns || (message.$unknowns = [])).push($util.rawField(5, 0, reader.raw(start, reader.pos)));
                                    }
                                }
                                if (reader.pos !== end2)
                                    throw $RangeError("index out of range");
                                reader.len = end;
                                continue;
                            }
                            if (wireType !== 0)
                                break;
                            value = reader.int32();
                            if ($root.easemob.pb.Provision.CompressType[value] !== $undefined) {
                                if (!(message.compressType && message.compressType.length))
                                    message.compressType = [];
                                message.compressType.push(value);
                            } else if (!reader.discardUnknown) {
                                $util.makeProp(message, "$unknowns", false);
                                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                            }
                            continue;
                        }
                    case 6: {
                            if (wireType === 2) {
                                if (!(message.encryptType && message.encryptType.length))
                                    message.encryptType = [];
                                reader.int32s(message.encryptType);
                                continue;
                            }
                            if (wireType !== 0)
                                break;
                            if (!(message.encryptType && message.encryptType.length))
                                message.encryptType = [];
                            message.encryptType.push(reader.int32());
                            continue;
                        }
                    case 7: {
                            if (wireType !== 2)
                                break;
                            message.encryptKey = reader.string();
                            continue;
                        }
                    case 8: {
                            if (wireType !== 2)
                                break;
                            message.status = $root.easemob.pb.Status.decode(reader, reader.size(), $undefined, _depth + 1, message.status);
                            continue;
                        }
                    case 9: {
                            if (wireType !== 2)
                                break;
                            message.deviceUuid = reader.string();
                            continue;
                        }
                    case 10: {
                            if (wireType !== 0)
                                break;
                            message.isManualLogin = reader.bool();
                            continue;
                        }
                    case 11: {
                            if (wireType !== 2)
                                break;
                            message.password = reader.string();
                            continue;
                        }
                    case 12: {
                            if (wireType !== 2)
                                break;
                            message.deviceName = reader.string();
                            continue;
                        }
                    case 13: {
                            if (wireType !== 2)
                                break;
                            message.resource = reader.string();
                            continue;
                        }
                    case 14: {
                            if (wireType !== 2)
                                break;
                            message.auth = reader.string();
                            continue;
                        }
                    case 16: {
                            if (wireType !== 2)
                                break;
                            message.serviceId = reader.string();
                            continue;
                        }
                    case 17: {
                            if (wireType !== 2)
                                break;
                            message.actionVersion = reader.string();
                            continue;
                        }
                    case 18: {
                            if (wireType !== 2)
                                break;
                            message.authToken = reader.string();
                            continue;
                        }
                    case 19: {
                            if (wireType !== 0)
                                break;
                            message.osCustomValue = reader.uint32();
                            continue;
                        }
                    case 20: {
                            if (wireType !== 2)
                                break;
                            message.sessionId = reader.string();
                            continue;
                        }
                    case 21: {
                            if (wireType !== 2)
                                break;
                            message.reason = reader.string();
                            continue;
                        }
                    }
                    reader.skipType(wireType, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (length !== $undefined) {
                    if (reader.pos !== end)
                        throw $RangeError("index out of range");
                    reader.len = length;
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                return message;
            };

            Provision.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.size());
            };

            Provision.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                if (message.osType != null && $Object.hasOwnProperty.call(message, "osType"))
                    switch (message.osType) {
                    default:
                        return "osType: enum value expected";
                    case 0:
                    case 1:
                    case 2:
                    case 3:
                    case 4:
                    case 5:
                    case 16:
                        break;
                    }
                if (message.version != null && $Object.hasOwnProperty.call(message, "version"))
                    if (!$util.isString(message.version))
                        return "version: string expected";
                if (message.networkType != null && $Object.hasOwnProperty.call(message, "networkType"))
                    switch (message.networkType) {
                    default:
                        return "networkType: enum value expected";
                    case 0:
                    case 1:
                    case 2:
                    case 3:
                    case 4:
                    case 5:
                        break;
                    }
                if (message.appSign != null && $Object.hasOwnProperty.call(message, "appSign"))
                    if (!$util.isString(message.appSign))
                        return "appSign: string expected";
                if (message.compressType != null && $Object.hasOwnProperty.call(message, "compressType")) {
                    if (!$Array.isArray(message.compressType))
                        return "compressType: array expected";
                    for (let i = 0; i < message.compressType.length; ++i)
                        switch (message.compressType[i]) {
                        default:
                            return "compressType: enum value[] expected";
                        case 0:
                        case 1:
                            break;
                        }
                }
                if (message.encryptType != null && $Object.hasOwnProperty.call(message, "encryptType")) {
                    if (!$Array.isArray(message.encryptType))
                        return "encryptType: array expected";
                    for (let i = 0; i < message.encryptType.length; ++i)
                        if (typeof message.encryptType[i] !== "number" || (message.encryptType[i] | 0) !== message.encryptType[i])
                            return "encryptType: enum value[] expected";
                }
                if (message.encryptKey != null && $Object.hasOwnProperty.call(message, "encryptKey"))
                    if (!$util.isString(message.encryptKey))
                        return "encryptKey: string expected";
                if (message.status != null && $Object.hasOwnProperty.call(message, "status")) {
                    let error = $root.easemob.pb.Status.verify(message.status, _depth + 1);
                    if (error)
                        return "status." + error;
                }
                if (message.deviceUuid != null && $Object.hasOwnProperty.call(message, "deviceUuid"))
                    if (!$util.isString(message.deviceUuid))
                        return "deviceUuid: string expected";
                if (message.isManualLogin != null && $Object.hasOwnProperty.call(message, "isManualLogin"))
                    if (typeof message.isManualLogin !== "boolean")
                        return "isManualLogin: boolean expected";
                if (message.password != null && $Object.hasOwnProperty.call(message, "password"))
                    if (!$util.isString(message.password))
                        return "password: string expected";
                if (message.deviceName != null && $Object.hasOwnProperty.call(message, "deviceName"))
                    if (!$util.isString(message.deviceName))
                        return "deviceName: string expected";
                if (message.resource != null && $Object.hasOwnProperty.call(message, "resource"))
                    if (!$util.isString(message.resource))
                        return "resource: string expected";
                if (message.auth != null && $Object.hasOwnProperty.call(message, "auth"))
                    if (!$util.isString(message.auth))
                        return "auth: string expected";
                if (message.serviceId != null && $Object.hasOwnProperty.call(message, "serviceId"))
                    if (!$util.isString(message.serviceId))
                        return "serviceId: string expected";
                if (message.actionVersion != null && $Object.hasOwnProperty.call(message, "actionVersion"))
                    if (!$util.isString(message.actionVersion))
                        return "actionVersion: string expected";
                if (message.authToken != null && $Object.hasOwnProperty.call(message, "authToken"))
                    if (!$util.isString(message.authToken))
                        return "authToken: string expected";
                if (message.osCustomValue != null && $Object.hasOwnProperty.call(message, "osCustomValue"))
                    if (!$util.isInteger(message.osCustomValue))
                        return "osCustomValue: integer expected";
                if (message.sessionId != null && $Object.hasOwnProperty.call(message, "sessionId"))
                    if (!$util.isString(message.sessionId))
                        return "sessionId: string expected";
                if (message.reason != null && $Object.hasOwnProperty.call(message, "reason"))
                    if (!$util.isString(message.reason))
                        return "reason: string expected";
                return null;
            };

            Provision.fromObject = function (object, _depth) {
                if (object instanceof $root.easemob.pb.Provision)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".easemob.pb.Provision: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let message = new $root.easemob.pb.Provision();
                switch (object.osType) {
                case "OS_IOS":
                case 0:
                    message.osType = 0;
                    break;
                case "OS_ANDROID":
                case 1:
                    message.osType = 1;
                    break;
                case "OS_LINUX":
                case 2:
                    message.osType = 2;
                    break;
                case "OS_OSX":
                case 3:
                    message.osType = 3;
                    break;
                case "OS_WIN":
                case 4:
                    message.osType = 4;
                    break;
                case "OS_CUSTOM":
                case 5:
                    message.osType = 5;
                    break;
                case "OS_OTHER":
                case 16:
                    message.osType = 16;
                    break;
                default:
                }
                if (object.version != null)
                    message.version = $String(object.version);
                switch (object.networkType) {
                case "NETWORK_NONE":
                case 0:
                    message.networkType = 0;
                    break;
                case "NETWORK_WIFI":
                case 1:
                    message.networkType = 1;
                    break;
                case "NETWORK_4G":
                case 2:
                    message.networkType = 2;
                    break;
                case "NETWORK_3G":
                case 3:
                    message.networkType = 3;
                    break;
                case "NETWORK_2G":
                case 4:
                    message.networkType = 4;
                    break;
                case "NETWORK_WIRE":
                case 5:
                    message.networkType = 5;
                    break;
                default:
                }
                if (object.appSign != null)
                    message.appSign = $String(object.appSign);
                if (object.compressType) {
                    if (!$Array.isArray(object.compressType))
                        throw $TypeError(".easemob.pb.Provision.compressType: array expected");
                    message.compressType = [];
                    for (let i = 0; i < object.compressType.length; ++i)
                        switch (object.compressType[i]) {
                        case "COMPRESS_NONE":
                        case 0:
                            message.compressType[message.compressType.length] = 0;
                            break;
                        case "COMPRESS_ZLIB":
                        case 1:
                            message.compressType[message.compressType.length] = 1;
                            break;
                        default:
                        }
                }
                if (object.encryptType) {
                    if (!$Array.isArray(object.encryptType))
                        throw $TypeError(".easemob.pb.Provision.encryptType: array expected");
                    message.encryptType = [];
                    for (let i = 0; i < object.encryptType.length; ++i)
                        switch (object.encryptType[i]) {
                        case "ENCRYPT_NONE":
                        case 0:
                            message.encryptType[message.encryptType.length] = 0;
                            break;
                        case "ENCRYPT_AES_128_CBC":
                        case 1:
                            message.encryptType[message.encryptType.length] = 1;
                            break;
                        case "ENCRYPT_AES_256_CBC":
                        case 2:
                            message.encryptType[message.encryptType.length] = 2;
                            break;
                        default:
                            if (typeof object.encryptType[i] === "number" && (object.encryptType[i] | 0) === object.encryptType[i])
                                message.encryptType[message.encryptType.length] = object.encryptType[i];
                        }
                }
                if (object.encryptKey != null)
                    message.encryptKey = $String(object.encryptKey);
                if (object.status != null) {
                    if (!$util.isObject(object.status))
                        throw $TypeError(".easemob.pb.Provision.status: object expected");
                    message.status = $root.easemob.pb.Status.fromObject(object.status, _depth + 1);
                }
                if (object.deviceUuid != null)
                    message.deviceUuid = $String(object.deviceUuid);
                if (object.isManualLogin != null)
                    message.isManualLogin = $Boolean(object.isManualLogin);
                if (object.password != null)
                    message.password = $String(object.password);
                if (object.deviceName != null)
                    message.deviceName = $String(object.deviceName);
                if (object.resource != null)
                    message.resource = $String(object.resource);
                if (object.auth != null)
                    message.auth = $String(object.auth);
                if (object.serviceId != null)
                    message.serviceId = $String(object.serviceId);
                if (object.actionVersion != null)
                    message.actionVersion = $String(object.actionVersion);
                if (object.authToken != null)
                    message.authToken = $String(object.authToken);
                if (object.osCustomValue != null)
                    message.osCustomValue = object.osCustomValue >>> 0;
                if (object.sessionId != null)
                    message.sessionId = $String(object.sessionId);
                if (object.reason != null)
                    message.reason = $String(object.reason);
                return message;
            };

            Provision.toObject = function (message, options, _depth) {
                if (!options)
                    options = {};
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let object = {};
                if (options.arrays || options.defaults) {
                    object.compressType = [];
                    object.encryptType = [];
                }
                if (options.defaults) {
                    object.osType = options.enums === $String ? "OS_IOS" : 0;
                    object.version = "";
                    object.networkType = options.enums === $String ? "NETWORK_NONE" : 0;
                    object.appSign = "";
                    object.encryptKey = "";
                    object.status = null;
                    object.deviceUuid = "";
                    object.isManualLogin = false;
                    object.password = "";
                    object.deviceName = "";
                    object.resource = "";
                    object.auth = "";
                    object.serviceId = "";
                    object.actionVersion = "";
                    object.authToken = "";
                    object.osCustomValue = 0;
                    object.sessionId = "";
                    object.reason = "";
                }
                if (message.osType != null && $Object.hasOwnProperty.call(message, "osType"))
                    object.osType = options.enums === $String ? $root.easemob.pb.Provision.OsType[message.osType] === $undefined ? message.osType : $root.easemob.pb.Provision.OsType[message.osType] : message.osType;
                if (message.version != null && $Object.hasOwnProperty.call(message, "version"))
                    object.version = message.version;
                if (message.networkType != null && $Object.hasOwnProperty.call(message, "networkType"))
                    object.networkType = options.enums === $String ? $root.easemob.pb.Provision.NetworkType[message.networkType] === $undefined ? message.networkType : $root.easemob.pb.Provision.NetworkType[message.networkType] : message.networkType;
                if (message.appSign != null && $Object.hasOwnProperty.call(message, "appSign"))
                    object.appSign = message.appSign;
                if (message.compressType && message.compressType.length) {
                    object.compressType = $Array(message.compressType.length);
                    for (let j = 0; j < message.compressType.length; ++j)
                        object.compressType[j] = options.enums === $String ? $root.easemob.pb.Provision.CompressType[message.compressType[j]] === $undefined ? message.compressType[j] : $root.easemob.pb.Provision.CompressType[message.compressType[j]] : message.compressType[j];
                }
                if (message.encryptType && message.encryptType.length) {
                    object.encryptType = $Array(message.encryptType.length);
                    for (let j = 0; j < message.encryptType.length; ++j)
                        object.encryptType[j] = options.enums === $String ? $root.easemob.pb.EncryptType[message.encryptType[j]] === $undefined ? message.encryptType[j] : $root.easemob.pb.EncryptType[message.encryptType[j]] : message.encryptType[j];
                }
                if (message.encryptKey != null && $Object.hasOwnProperty.call(message, "encryptKey"))
                    object.encryptKey = message.encryptKey;
                if (message.status != null && $Object.hasOwnProperty.call(message, "status"))
                    object.status = $root.easemob.pb.Status.toObject(message.status, options, _depth + 1);
                if (message.deviceUuid != null && $Object.hasOwnProperty.call(message, "deviceUuid"))
                    object.deviceUuid = message.deviceUuid;
                if (message.isManualLogin != null && $Object.hasOwnProperty.call(message, "isManualLogin"))
                    object.isManualLogin = message.isManualLogin;
                if (message.password != null && $Object.hasOwnProperty.call(message, "password"))
                    object.password = message.password;
                if (message.deviceName != null && $Object.hasOwnProperty.call(message, "deviceName"))
                    object.deviceName = message.deviceName;
                if (message.resource != null && $Object.hasOwnProperty.call(message, "resource"))
                    object.resource = message.resource;
                if (message.auth != null && $Object.hasOwnProperty.call(message, "auth"))
                    object.auth = message.auth;
                if (message.serviceId != null && $Object.hasOwnProperty.call(message, "serviceId"))
                    object.serviceId = message.serviceId;
                if (message.actionVersion != null && $Object.hasOwnProperty.call(message, "actionVersion"))
                    object.actionVersion = message.actionVersion;
                if (message.authToken != null && $Object.hasOwnProperty.call(message, "authToken"))
                    object.authToken = message.authToken;
                if (message.osCustomValue != null && $Object.hasOwnProperty.call(message, "osCustomValue"))
                    object.osCustomValue = message.osCustomValue;
                if (message.sessionId != null && $Object.hasOwnProperty.call(message, "sessionId"))
                    object.sessionId = message.sessionId;
                if (message.reason != null && $Object.hasOwnProperty.call(message, "reason"))
                    object.reason = message.reason;
                return object;
            };

            Provision.prototype.toJSON = function() {
                return Provision.toObject(this, $protobuf.util.toJSONOptions);
            };

            Provision.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/easemob.pb.Provision";
            };

            Provision.OsType = (function() {
                const valuesById = $Object.create(null), values = $Object.create(valuesById);
                values[valuesById[0] = "OS_IOS"] = 0;
                values[valuesById[1] = "OS_ANDROID"] = 1;
                values[valuesById[2] = "OS_LINUX"] = 2;
                values[valuesById[3] = "OS_OSX"] = 3;
                values[valuesById[4] = "OS_WIN"] = 4;
                values[valuesById[5] = "OS_CUSTOM"] = 5;
                values[valuesById[16] = "OS_OTHER"] = 16;
                return values;
            })();

            Provision.NetworkType = (function() {
                const valuesById = $Object.create(null), values = $Object.create(valuesById);
                values[valuesById[0] = "NETWORK_NONE"] = 0;
                values[valuesById[1] = "NETWORK_WIFI"] = 1;
                values[valuesById[2] = "NETWORK_4G"] = 2;
                values[valuesById[3] = "NETWORK_3G"] = 3;
                values[valuesById[4] = "NETWORK_2G"] = 4;
                values[valuesById[5] = "NETWORK_WIRE"] = 5;
                return values;
            })();

            Provision.CompressType = (function() {
                const valuesById = $Object.create(null), values = $Object.create(valuesById);
                values[valuesById[0] = "COMPRESS_NONE"] = 0;
                values[valuesById[1] = "COMPRESS_ZLIB"] = 1;
                return values;
            })();

            return Provision;
        })();

        pb.MUCBody = (function() {

            const MUCBody = function (properties) {
                this.to = [];
                this.members = [];
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            MUCBody.prototype.mucId = null;

            MUCBody.prototype.operation = 0;

            MUCBody.prototype.from = null;

            MUCBody.prototype.to = $util.emptyArray;

            MUCBody.prototype.setting = null;

            MUCBody.prototype.reason = "";

            MUCBody.prototype.isChatroom = false;

            MUCBody.prototype.status = null;

            MUCBody.prototype.isThread = false;

            MUCBody.prototype.mucParentId = null;

            MUCBody.prototype.mucName = "";

            MUCBody.prototype.eventInfo = null;

            MUCBody.prototype.mucMemberCount = 0;

            MUCBody.prototype.ext = "";

            MUCBody.prototype.leaveOtherRooms = false;

            MUCBody.prototype.members = $util.emptyArray;

            MUCBody.create = function(properties) {
                return new MUCBody(properties);
            };

            MUCBody.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                if (message.mucId != null && $Object.hasOwnProperty.call(message, "mucId"))
                    $root.easemob.pb.JID.encode(message.mucId, writer.uint32(/* id 1, wireType 2 =*/10).fork(), _depth + 1).ldelim();
                if (message.operation != null && $Object.hasOwnProperty.call(message, "operation"))
                    writer.uint32(/* id 2, wireType 0 =*/16).int32(message.operation);
                if (message.from != null && $Object.hasOwnProperty.call(message, "from"))
                    $root.easemob.pb.JID.encode(message.from, writer.uint32(/* id 3, wireType 2 =*/26).fork(), _depth + 1).ldelim();
                if (message.to != null && message.to.length)
                    for (let i = 0; i < message.to.length; ++i)
                        $root.easemob.pb.JID.encode(message.to[i], writer.uint32(/* id 4, wireType 2 =*/34).fork(), _depth + 1).ldelim();
                if (message.setting != null && $Object.hasOwnProperty.call(message, "setting"))
                    $root.easemob.pb.MUCBody.Setting.encode(message.setting, writer.uint32(/* id 5, wireType 2 =*/42).fork(), _depth + 1).ldelim();
                if (message.reason != null && $Object.hasOwnProperty.call(message, "reason"))
                    writer.uint32(/* id 6, wireType 2 =*/50).string(message.reason);
                if (message.isChatroom != null && $Object.hasOwnProperty.call(message, "isChatroom"))
                    writer.uint32(/* id 7, wireType 0 =*/56).bool(message.isChatroom);
                if (message.status != null && $Object.hasOwnProperty.call(message, "status"))
                    $root.easemob.pb.MUCBody.Status.encode(message.status, writer.uint32(/* id 8, wireType 2 =*/66).fork(), _depth + 1).ldelim();
                if (message.isThread != null && $Object.hasOwnProperty.call(message, "isThread"))
                    writer.uint32(/* id 9, wireType 0 =*/72).bool(message.isThread);
                if (message.mucParentId != null && $Object.hasOwnProperty.call(message, "mucParentId"))
                    $root.easemob.pb.JID.encode(message.mucParentId, writer.uint32(/* id 10, wireType 2 =*/82).fork(), _depth + 1).ldelim();
                if (message.mucName != null && $Object.hasOwnProperty.call(message, "mucName"))
                    writer.uint32(/* id 11, wireType 2 =*/90).string(message.mucName);
                if (message.eventInfo != null && $Object.hasOwnProperty.call(message, "eventInfo"))
                    $root.easemob.pb.MUCBody.EventInfo.encode(message.eventInfo, writer.uint32(/* id 12, wireType 2 =*/98).fork(), _depth + 1).ldelim();
                if (message.mucMemberCount != null && $Object.hasOwnProperty.call(message, "mucMemberCount"))
                    writer.uint32(/* id 13, wireType 0 =*/104).int32(message.mucMemberCount);
                if (message.ext != null && $Object.hasOwnProperty.call(message, "ext"))
                    writer.uint32(/* id 14, wireType 2 =*/114).string(message.ext);
                if (message.leaveOtherRooms != null && $Object.hasOwnProperty.call(message, "leaveOtherRooms"))
                    writer.uint32(/* id 15, wireType 0 =*/120).bool(message.leaveOtherRooms);
                if (message.members != null && message.members.length)
                    for (let i = 0; i < message.members.length; ++i)
                        writer.uint32(/* id 16, wireType 2 =*/130).string(message.members[i]);
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            MUCBody.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            MUCBody.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end, message, value;
                if (length === $undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw $RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = _target || new $root.easemob.pb.MUCBody();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType !== 2)
                                break;
                            message.mucId = $root.easemob.pb.JID.decode(reader, reader.size(), $undefined, _depth + 1, message.mucId);
                            continue;
                        }
                    case 2: {
                            if (wireType !== 0)
                                break;
                            value = reader.int32();
                            if ($root.easemob.pb.MUCBody.Operation[value] !== $undefined)
                                message.operation = value;
                            else if (!reader.discardUnknown) {
                                $util.makeProp(message, "$unknowns", false);
                                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                            }
                            continue;
                        }
                    case 3: {
                            if (wireType !== 2)
                                break;
                            message.from = $root.easemob.pb.JID.decode(reader, reader.size(), $undefined, _depth + 1, message.from);
                            continue;
                        }
                    case 4: {
                            if (wireType !== 2)
                                break;
                            if (!(message.to && message.to.length))
                                message.to = [];
                            message.to.push($root.easemob.pb.JID.decode(reader, reader.size(), $undefined, _depth + 1));
                            continue;
                        }
                    case 5: {
                            if (wireType !== 2)
                                break;
                            message.setting = $root.easemob.pb.MUCBody.Setting.decode(reader, reader.size(), $undefined, _depth + 1, message.setting);
                            continue;
                        }
                    case 6: {
                            if (wireType !== 2)
                                break;
                            message.reason = reader.string();
                            continue;
                        }
                    case 7: {
                            if (wireType !== 0)
                                break;
                            message.isChatroom = reader.bool();
                            continue;
                        }
                    case 8: {
                            if (wireType !== 2)
                                break;
                            message.status = $root.easemob.pb.MUCBody.Status.decode(reader, reader.size(), $undefined, _depth + 1, message.status);
                            continue;
                        }
                    case 9: {
                            if (wireType !== 0)
                                break;
                            message.isThread = reader.bool();
                            continue;
                        }
                    case 10: {
                            if (wireType !== 2)
                                break;
                            message.mucParentId = $root.easemob.pb.JID.decode(reader, reader.size(), $undefined, _depth + 1, message.mucParentId);
                            continue;
                        }
                    case 11: {
                            if (wireType !== 2)
                                break;
                            message.mucName = reader.string();
                            continue;
                        }
                    case 12: {
                            if (wireType !== 2)
                                break;
                            message.eventInfo = $root.easemob.pb.MUCBody.EventInfo.decode(reader, reader.size(), $undefined, _depth + 1, message.eventInfo);
                            continue;
                        }
                    case 13: {
                            if (wireType !== 0)
                                break;
                            message.mucMemberCount = reader.int32();
                            continue;
                        }
                    case 14: {
                            if (wireType !== 2)
                                break;
                            message.ext = reader.string();
                            continue;
                        }
                    case 15: {
                            if (wireType !== 0)
                                break;
                            message.leaveOtherRooms = reader.bool();
                            continue;
                        }
                    case 16: {
                            if (wireType !== 2)
                                break;
                            if (!(message.members && message.members.length))
                                message.members = [];
                            message.members.push(reader.string());
                            continue;
                        }
                    }
                    reader.skipType(wireType, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (length !== $undefined) {
                    if (reader.pos !== end)
                        throw $RangeError("index out of range");
                    reader.len = length;
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                return message;
            };

            MUCBody.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.size());
            };

            MUCBody.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                if (message.mucId != null && $Object.hasOwnProperty.call(message, "mucId")) {
                    let error = $root.easemob.pb.JID.verify(message.mucId, _depth + 1);
                    if (error)
                        return "mucId." + error;
                }
                if (message.operation != null && $Object.hasOwnProperty.call(message, "operation"))
                    switch (message.operation) {
                    default:
                        return "operation: enum value expected";
                    case 0:
                    case 1:
                    case 2:
                    case 3:
                    case 4:
                    case 5:
                    case 6:
                    case 7:
                    case 8:
                    case 9:
                    case 10:
                    case 11:
                    case 12:
                    case 13:
                    case 14:
                    case 15:
                    case 16:
                    case 17:
                    case 18:
                    case 19:
                    case 20:
                    case 21:
                    case 22:
                    case 23:
                    case 24:
                    case 25:
                    case 26:
                    case 27:
                    case 28:
                    case 29:
                    case 30:
                    case 31:
                    case 32:
                    case 33:
                    case 34:
                    case 35:
                    case 36:
                    case 37:
                    case 38:
                    case 39:
                    case 40:
                    case 41:
                    case 42:
                    case 43:
                    case 44:
                    case 45:
                        break;
                    }
                if (message.from != null && $Object.hasOwnProperty.call(message, "from")) {
                    let error = $root.easemob.pb.JID.verify(message.from, _depth + 1);
                    if (error)
                        return "from." + error;
                }
                if (message.to != null && $Object.hasOwnProperty.call(message, "to")) {
                    if (!$Array.isArray(message.to))
                        return "to: array expected";
                    for (let i = 0; i < message.to.length; ++i) {
                        let error = $root.easemob.pb.JID.verify(message.to[i], _depth + 1);
                        if (error)
                            return "to." + error;
                    }
                }
                if (message.setting != null && $Object.hasOwnProperty.call(message, "setting")) {
                    let error = $root.easemob.pb.MUCBody.Setting.verify(message.setting, _depth + 1);
                    if (error)
                        return "setting." + error;
                }
                if (message.reason != null && $Object.hasOwnProperty.call(message, "reason"))
                    if (!$util.isString(message.reason))
                        return "reason: string expected";
                if (message.isChatroom != null && $Object.hasOwnProperty.call(message, "isChatroom"))
                    if (typeof message.isChatroom !== "boolean")
                        return "isChatroom: boolean expected";
                if (message.status != null && $Object.hasOwnProperty.call(message, "status")) {
                    let error = $root.easemob.pb.MUCBody.Status.verify(message.status, _depth + 1);
                    if (error)
                        return "status." + error;
                }
                if (message.isThread != null && $Object.hasOwnProperty.call(message, "isThread"))
                    if (typeof message.isThread !== "boolean")
                        return "isThread: boolean expected";
                if (message.mucParentId != null && $Object.hasOwnProperty.call(message, "mucParentId")) {
                    let error = $root.easemob.pb.JID.verify(message.mucParentId, _depth + 1);
                    if (error)
                        return "mucParentId." + error;
                }
                if (message.mucName != null && $Object.hasOwnProperty.call(message, "mucName"))
                    if (!$util.isString(message.mucName))
                        return "mucName: string expected";
                if (message.eventInfo != null && $Object.hasOwnProperty.call(message, "eventInfo")) {
                    let error = $root.easemob.pb.MUCBody.EventInfo.verify(message.eventInfo, _depth + 1);
                    if (error)
                        return "eventInfo." + error;
                }
                if (message.mucMemberCount != null && $Object.hasOwnProperty.call(message, "mucMemberCount"))
                    if (!$util.isInteger(message.mucMemberCount))
                        return "mucMemberCount: integer expected";
                if (message.ext != null && $Object.hasOwnProperty.call(message, "ext"))
                    if (!$util.isString(message.ext))
                        return "ext: string expected";
                if (message.leaveOtherRooms != null && $Object.hasOwnProperty.call(message, "leaveOtherRooms"))
                    if (typeof message.leaveOtherRooms !== "boolean")
                        return "leaveOtherRooms: boolean expected";
                if (message.members != null && $Object.hasOwnProperty.call(message, "members")) {
                    if (!$Array.isArray(message.members))
                        return "members: array expected";
                    for (let i = 0; i < message.members.length; ++i)
                        if (!$util.isString(message.members[i]))
                            return "members: string[] expected";
                }
                return null;
            };

            MUCBody.fromObject = function (object, _depth) {
                if (object instanceof $root.easemob.pb.MUCBody)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".easemob.pb.MUCBody: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let message = new $root.easemob.pb.MUCBody();
                if (object.mucId != null) {
                    if (!$util.isObject(object.mucId))
                        throw $TypeError(".easemob.pb.MUCBody.mucId: object expected");
                    message.mucId = $root.easemob.pb.JID.fromObject(object.mucId, _depth + 1);
                }
                switch (object.operation) {
                case "CREATE":
                case 0:
                    message.operation = 0;
                    break;
                case "DESTROY":
                case 1:
                    message.operation = 1;
                    break;
                case "JOIN":
                case 2:
                    message.operation = 2;
                    break;
                case "LEAVE":
                case 3:
                    message.operation = 3;
                    break;
                case "APPLY":
                case 4:
                    message.operation = 4;
                    break;
                case "APPLY_ACCEPT":
                case 5:
                    message.operation = 5;
                    break;
                case "APPLY_DECLINE":
                case 6:
                    message.operation = 6;
                    break;
                case "INVITE":
                case 7:
                    message.operation = 7;
                    break;
                case "INVITE_ACCEPT":
                case 8:
                    message.operation = 8;
                    break;
                case "INVITE_DECLINE":
                case 9:
                    message.operation = 9;
                    break;
                case "KICK":
                case 10:
                    message.operation = 10;
                    break;
                case "GET_BLACKLIST":
                case 11:
                    message.operation = 11;
                    break;
                case "BAN":
                case 12:
                    message.operation = 12;
                    break;
                case "ALLOW":
                case 13:
                    message.operation = 13;
                    break;
                case "UPDATE":
                case 14:
                    message.operation = 14;
                    break;
                case "BLOCK":
                case 15:
                    message.operation = 15;
                    break;
                case "UNBLOCK":
                case 16:
                    message.operation = 16;
                    break;
                case "PRESENCE":
                case 17:
                    message.operation = 17;
                    break;
                case "ABSENCE":
                case 18:
                    message.operation = 18;
                    break;
                case "DIRECT_JOINED":
                case 19:
                    message.operation = 19;
                    break;
                case "ASSIGN_OWNER":
                case 20:
                    message.operation = 20;
                    break;
                case "ADD_ADMIN":
                case 21:
                    message.operation = 21;
                    break;
                case "REMOVE_ADMIN":
                case 22:
                    message.operation = 22;
                    break;
                case "ADD_MUTE":
                case 23:
                    message.operation = 23;
                    break;
                case "REMOVE_MUTE":
                case 24:
                    message.operation = 24;
                    break;
                case "UPDATE_ANNOUNCEMENT":
                case 25:
                    message.operation = 25;
                    break;
                case "DELETE_ANNOUNCEMENT":
                case 26:
                    message.operation = 26;
                    break;
                case "UPLOAD_FILE":
                case 27:
                    message.operation = 27;
                    break;
                case "DELETE_FILE":
                case 28:
                    message.operation = 28;
                    break;
                case "ADD_USER_WHITE_LIST":
                case 29:
                    message.operation = 29;
                    break;
                case "REMOVE_USER_WHITE_LIST":
                case 30:
                    message.operation = 30;
                    break;
                case "BAN_GROUP":
                case 31:
                    message.operation = 31;
                    break;
                case "REMOVE_BAN_GROUP":
                case 32:
                    message.operation = 32;
                    break;
                case "THREAD_CREATE":
                case 33:
                    message.operation = 33;
                    break;
                case "THREAD_DESTROY":
                case 34:
                    message.operation = 34;
                    break;
                case "THREAD_JOIN":
                case 35:
                    message.operation = 35;
                    break;
                case "THREAD_LEAVE":
                case 36:
                    message.operation = 36;
                    break;
                case "THREAD_KICK":
                case 37:
                    message.operation = 37;
                    break;
                case "THREAD_UPDATE":
                case 38:
                    message.operation = 38;
                    break;
                case "THREAD_PRESENCE":
                case 39:
                    message.operation = 39;
                    break;
                case "THREAD_ABSENCE":
                case 40:
                    message.operation = 40;
                    break;
                case "DISABLE_GROUP":
                case 41:
                    message.operation = 41;
                    break;
                case "ABLE_GROUP":
                case 42:
                    message.operation = 42;
                    break;
                case "SET_METADATA":
                case 43:
                    message.operation = 43;
                    break;
                case "DELETE_METADATA":
                case 44:
                    message.operation = 44;
                    break;
                case "GROUP_MEMBER_METADATA_UPDATE":
                case 45:
                    message.operation = 45;
                    break;
                default:
                }
                if (object.from != null) {
                    if (!$util.isObject(object.from))
                        throw $TypeError(".easemob.pb.MUCBody.from: object expected");
                    message.from = $root.easemob.pb.JID.fromObject(object.from, _depth + 1);
                }
                if (object.to) {
                    if (!$Array.isArray(object.to))
                        throw $TypeError(".easemob.pb.MUCBody.to: array expected");
                    message.to = $Array(object.to.length);
                    for (let i = 0; i < object.to.length; ++i) {
                        if (!$util.isObject(object.to[i]))
                            throw $TypeError(".easemob.pb.MUCBody.to: object expected");
                        message.to[i] = $root.easemob.pb.JID.fromObject(object.to[i], _depth + 1);
                    }
                }
                if (object.setting != null) {
                    if (!$util.isObject(object.setting))
                        throw $TypeError(".easemob.pb.MUCBody.setting: object expected");
                    message.setting = $root.easemob.pb.MUCBody.Setting.fromObject(object.setting, _depth + 1);
                }
                if (object.reason != null)
                    message.reason = $String(object.reason);
                if (object.isChatroom != null)
                    message.isChatroom = $Boolean(object.isChatroom);
                if (object.status != null) {
                    if (!$util.isObject(object.status))
                        throw $TypeError(".easemob.pb.MUCBody.status: object expected");
                    message.status = $root.easemob.pb.MUCBody.Status.fromObject(object.status, _depth + 1);
                }
                if (object.isThread != null)
                    message.isThread = $Boolean(object.isThread);
                if (object.mucParentId != null) {
                    if (!$util.isObject(object.mucParentId))
                        throw $TypeError(".easemob.pb.MUCBody.mucParentId: object expected");
                    message.mucParentId = $root.easemob.pb.JID.fromObject(object.mucParentId, _depth + 1);
                }
                if (object.mucName != null)
                    message.mucName = $String(object.mucName);
                if (object.eventInfo != null) {
                    if (!$util.isObject(object.eventInfo))
                        throw $TypeError(".easemob.pb.MUCBody.eventInfo: object expected");
                    message.eventInfo = $root.easemob.pb.MUCBody.EventInfo.fromObject(object.eventInfo, _depth + 1);
                }
                if (object.mucMemberCount != null)
                    message.mucMemberCount = object.mucMemberCount | 0;
                if (object.ext != null)
                    message.ext = $String(object.ext);
                if (object.leaveOtherRooms != null)
                    message.leaveOtherRooms = $Boolean(object.leaveOtherRooms);
                if (object.members) {
                    if (!$Array.isArray(object.members))
                        throw $TypeError(".easemob.pb.MUCBody.members: array expected");
                    message.members = $Array(object.members.length);
                    for (let i = 0; i < object.members.length; ++i)
                        message.members[i] = $String(object.members[i]);
                }
                return message;
            };

            MUCBody.toObject = function (message, options, _depth) {
                if (!options)
                    options = {};
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let object = {};
                if (options.arrays || options.defaults) {
                    object.to = [];
                    object.members = [];
                }
                if (options.defaults) {
                    object.mucId = null;
                    object.operation = options.enums === $String ? "CREATE" : 0;
                    object.from = null;
                    object.setting = null;
                    object.reason = "";
                    object.isChatroom = false;
                    object.status = null;
                    object.isThread = false;
                    object.mucParentId = null;
                    object.mucName = "";
                    object.eventInfo = null;
                    object.mucMemberCount = 0;
                    object.ext = "";
                    object.leaveOtherRooms = false;
                }
                if (message.mucId != null && $Object.hasOwnProperty.call(message, "mucId"))
                    object.mucId = $root.easemob.pb.JID.toObject(message.mucId, options, _depth + 1);
                if (message.operation != null && $Object.hasOwnProperty.call(message, "operation"))
                    object.operation = options.enums === $String ? $root.easemob.pb.MUCBody.Operation[message.operation] === $undefined ? message.operation : $root.easemob.pb.MUCBody.Operation[message.operation] : message.operation;
                if (message.from != null && $Object.hasOwnProperty.call(message, "from"))
                    object.from = $root.easemob.pb.JID.toObject(message.from, options, _depth + 1);
                if (message.to && message.to.length) {
                    object.to = $Array(message.to.length);
                    for (let j = 0; j < message.to.length; ++j)
                        object.to[j] = $root.easemob.pb.JID.toObject(message.to[j], options, _depth + 1);
                }
                if (message.setting != null && $Object.hasOwnProperty.call(message, "setting"))
                    object.setting = $root.easemob.pb.MUCBody.Setting.toObject(message.setting, options, _depth + 1);
                if (message.reason != null && $Object.hasOwnProperty.call(message, "reason"))
                    object.reason = message.reason;
                if (message.isChatroom != null && $Object.hasOwnProperty.call(message, "isChatroom"))
                    object.isChatroom = message.isChatroom;
                if (message.status != null && $Object.hasOwnProperty.call(message, "status"))
                    object.status = $root.easemob.pb.MUCBody.Status.toObject(message.status, options, _depth + 1);
                if (message.isThread != null && $Object.hasOwnProperty.call(message, "isThread"))
                    object.isThread = message.isThread;
                if (message.mucParentId != null && $Object.hasOwnProperty.call(message, "mucParentId"))
                    object.mucParentId = $root.easemob.pb.JID.toObject(message.mucParentId, options, _depth + 1);
                if (message.mucName != null && $Object.hasOwnProperty.call(message, "mucName"))
                    object.mucName = message.mucName;
                if (message.eventInfo != null && $Object.hasOwnProperty.call(message, "eventInfo"))
                    object.eventInfo = $root.easemob.pb.MUCBody.EventInfo.toObject(message.eventInfo, options, _depth + 1);
                if (message.mucMemberCount != null && $Object.hasOwnProperty.call(message, "mucMemberCount"))
                    object.mucMemberCount = message.mucMemberCount;
                if (message.ext != null && $Object.hasOwnProperty.call(message, "ext"))
                    object.ext = message.ext;
                if (message.leaveOtherRooms != null && $Object.hasOwnProperty.call(message, "leaveOtherRooms"))
                    object.leaveOtherRooms = message.leaveOtherRooms;
                if (message.members && message.members.length) {
                    object.members = $Array(message.members.length);
                    for (let j = 0; j < message.members.length; ++j)
                        object.members[j] = message.members[j];
                }
                return object;
            };

            MUCBody.prototype.toJSON = function() {
                return MUCBody.toObject(this, $protobuf.util.toJSONOptions);
            };

            MUCBody.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/easemob.pb.MUCBody";
            };

            MUCBody.Operation = (function() {
                const valuesById = $Object.create(null), values = $Object.create(valuesById);
                values[valuesById[0] = "CREATE"] = 0;
                values[valuesById[1] = "DESTROY"] = 1;
                values[valuesById[2] = "JOIN"] = 2;
                values[valuesById[3] = "LEAVE"] = 3;
                values[valuesById[4] = "APPLY"] = 4;
                values[valuesById[5] = "APPLY_ACCEPT"] = 5;
                values[valuesById[6] = "APPLY_DECLINE"] = 6;
                values[valuesById[7] = "INVITE"] = 7;
                values[valuesById[8] = "INVITE_ACCEPT"] = 8;
                values[valuesById[9] = "INVITE_DECLINE"] = 9;
                values[valuesById[10] = "KICK"] = 10;
                values[valuesById[11] = "GET_BLACKLIST"] = 11;
                values[valuesById[12] = "BAN"] = 12;
                values[valuesById[13] = "ALLOW"] = 13;
                values[valuesById[14] = "UPDATE"] = 14;
                values[valuesById[15] = "BLOCK"] = 15;
                values[valuesById[16] = "UNBLOCK"] = 16;
                values[valuesById[17] = "PRESENCE"] = 17;
                values[valuesById[18] = "ABSENCE"] = 18;
                values[valuesById[19] = "DIRECT_JOINED"] = 19;
                values[valuesById[20] = "ASSIGN_OWNER"] = 20;
                values[valuesById[21] = "ADD_ADMIN"] = 21;
                values[valuesById[22] = "REMOVE_ADMIN"] = 22;
                values[valuesById[23] = "ADD_MUTE"] = 23;
                values[valuesById[24] = "REMOVE_MUTE"] = 24;
                values[valuesById[25] = "UPDATE_ANNOUNCEMENT"] = 25;
                values[valuesById[26] = "DELETE_ANNOUNCEMENT"] = 26;
                values[valuesById[27] = "UPLOAD_FILE"] = 27;
                values[valuesById[28] = "DELETE_FILE"] = 28;
                values[valuesById[29] = "ADD_USER_WHITE_LIST"] = 29;
                values[valuesById[30] = "REMOVE_USER_WHITE_LIST"] = 30;
                values[valuesById[31] = "BAN_GROUP"] = 31;
                values[valuesById[32] = "REMOVE_BAN_GROUP"] = 32;
                values[valuesById[33] = "THREAD_CREATE"] = 33;
                values[valuesById[34] = "THREAD_DESTROY"] = 34;
                values[valuesById[35] = "THREAD_JOIN"] = 35;
                values[valuesById[36] = "THREAD_LEAVE"] = 36;
                values[valuesById[37] = "THREAD_KICK"] = 37;
                values[valuesById[38] = "THREAD_UPDATE"] = 38;
                values[valuesById[39] = "THREAD_PRESENCE"] = 39;
                values[valuesById[40] = "THREAD_ABSENCE"] = 40;
                values[valuesById[41] = "DISABLE_GROUP"] = 41;
                values[valuesById[42] = "ABLE_GROUP"] = 42;
                values[valuesById[43] = "SET_METADATA"] = 43;
                values[valuesById[44] = "DELETE_METADATA"] = 44;
                values[valuesById[45] = "GROUP_MEMBER_METADATA_UPDATE"] = 45;
                return values;
            })();

            MUCBody.Setting = (function() {

                const Setting = function (properties) {
                    if (properties)
                        for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                            if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                this[keys[i]] = properties[keys[i]];
                };

                Setting.prototype.name = "";

                Setting.prototype.desc = "";

                Setting.prototype.type = 0;

                Setting.prototype.maxUsers = 0;

                Setting.prototype.owner = "";

                Setting.create = function(properties) {
                    return new Setting(properties);
                };

                Setting.encode = function (message, writer, _depth) {
                    if (!writer)
                        writer = $Writer.create();
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $util.recursionLimit)
                        throw $Error("max depth exceeded");
                    if (message.name != null && $Object.hasOwnProperty.call(message, "name"))
                        writer.uint32(/* id 1, wireType 2 =*/10).string(message.name);
                    if (message.desc != null && $Object.hasOwnProperty.call(message, "desc"))
                        writer.uint32(/* id 2, wireType 2 =*/18).string(message.desc);
                    if (message.type != null && $Object.hasOwnProperty.call(message, "type"))
                        writer.uint32(/* id 3, wireType 0 =*/24).int32(message.type);
                    if (message.maxUsers != null && $Object.hasOwnProperty.call(message, "maxUsers"))
                        writer.uint32(/* id 4, wireType 0 =*/32).int32(message.maxUsers);
                    if (message.owner != null && $Object.hasOwnProperty.call(message, "owner"))
                        writer.uint32(/* id 5, wireType 2 =*/42).string(message.owner);
                    if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                        for (let i = 0; i < message.$unknowns.length; ++i)
                            writer.raw(message.$unknowns[i]);
                    return writer;
                };

                Setting.encodeDelimited = function(message, writer) {
                    return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
                };

                Setting.decode = function (reader, length, _end, _depth, _target) {
                    if (!(reader instanceof $Reader))
                        reader = $Reader.create(reader);
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $Reader.recursionLimit)
                        throw $Error("max depth exceeded");
                    let end, message, value;
                    if (length === $undefined)
                        end = reader.len;
                    else {
                        end = reader.pos + length;
                        if (end > reader.len)
                            throw $RangeError("index out of range");
                        length = reader.len;
                        reader.len = end;
                    }
                    message = _target || new $root.easemob.pb.MUCBody.Setting();
                    while (reader.pos < end) {
                        let start = reader.pos;
                        let tag = reader.tag();
                        if (tag === _end) {
                            _end = $undefined;
                            break;
                        }
                        let wireType = tag & 7;
                        switch (tag >>>= 3) {
                        case 1: {
                                if (wireType !== 2)
                                    break;
                                message.name = reader.string();
                                continue;
                            }
                        case 2: {
                                if (wireType !== 2)
                                    break;
                                message.desc = reader.string();
                                continue;
                            }
                        case 3: {
                                if (wireType !== 0)
                                    break;
                                value = reader.int32();
                                if ($root.easemob.pb.MUCBody.Setting.Type[value] !== $undefined)
                                    message.type = value;
                                else if (!reader.discardUnknown) {
                                    $util.makeProp(message, "$unknowns", false);
                                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                                }
                                continue;
                            }
                        case 4: {
                                if (wireType !== 0)
                                    break;
                                message.maxUsers = reader.int32();
                                continue;
                            }
                        case 5: {
                                if (wireType !== 2)
                                    break;
                                message.owner = reader.string();
                                continue;
                            }
                        }
                        reader.skipType(wireType, _depth, tag);
                        if (!reader.discardUnknown) {
                            $util.makeProp(message, "$unknowns", false);
                            (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                        }
                    }
                    if (length !== $undefined) {
                        if (reader.pos !== end)
                            throw $RangeError("index out of range");
                        reader.len = length;
                    }
                    if (_end !== $undefined)
                        throw $Error("missing end group");
                    return message;
                };

                Setting.decodeDelimited = function(reader) {
                    if (!(reader instanceof $Reader))
                        reader = new $Reader(reader);
                    return this.decode(reader, reader.size());
                };

                Setting.verify = function (message, _depth) {
                    if (typeof message !== "object" || message === null)
                        return "object expected";
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $util.recursionLimit)
                        return "max depth exceeded";
                    if (message.name != null && $Object.hasOwnProperty.call(message, "name"))
                        if (!$util.isString(message.name))
                            return "name: string expected";
                    if (message.desc != null && $Object.hasOwnProperty.call(message, "desc"))
                        if (!$util.isString(message.desc))
                            return "desc: string expected";
                    if (message.type != null && $Object.hasOwnProperty.call(message, "type"))
                        switch (message.type) {
                        default:
                            return "type: enum value expected";
                        case 0:
                        case 1:
                        case 2:
                        case 3:
                        case 4:
                            break;
                        }
                    if (message.maxUsers != null && $Object.hasOwnProperty.call(message, "maxUsers"))
                        if (!$util.isInteger(message.maxUsers))
                            return "maxUsers: integer expected";
                    if (message.owner != null && $Object.hasOwnProperty.call(message, "owner"))
                        if (!$util.isString(message.owner))
                            return "owner: string expected";
                    return null;
                };

                Setting.fromObject = function (object, _depth) {
                    if (object instanceof $root.easemob.pb.MUCBody.Setting)
                        return object;
                    if (!$util.isObject(object))
                        throw $TypeError(".easemob.pb.MUCBody.Setting: object expected");
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $util.recursionLimit)
                        throw $Error("max depth exceeded");
                    let message = new $root.easemob.pb.MUCBody.Setting();
                    if (object.name != null)
                        message.name = $String(object.name);
                    if (object.desc != null)
                        message.desc = $String(object.desc);
                    switch (object.type) {
                    case "PRIVATE_OWNER_INVITE":
                    case 0:
                        message.type = 0;
                        break;
                    case "PRIVATE_MEMBER_INVITE":
                    case 1:
                        message.type = 1;
                        break;
                    case "PUBLIC_JOIN_APPROVAL":
                    case 2:
                        message.type = 2;
                        break;
                    case "PUBLIC_JOIN_OPEN":
                    case 3:
                        message.type = 3;
                        break;
                    case "PUBLIC_ANONYMOUS":
                    case 4:
                        message.type = 4;
                        break;
                    default:
                    }
                    if (object.maxUsers != null)
                        message.maxUsers = object.maxUsers | 0;
                    if (object.owner != null)
                        message.owner = $String(object.owner);
                    return message;
                };

                Setting.toObject = function (message, options, _depth) {
                    if (!options)
                        options = {};
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $util.recursionLimit)
                        throw $Error("max depth exceeded");
                    let object = {};
                    if (options.defaults) {
                        object.name = "";
                        object.desc = "";
                        object.type = options.enums === $String ? "PRIVATE_OWNER_INVITE" : 0;
                        object.maxUsers = 0;
                        object.owner = "";
                    }
                    if (message.name != null && $Object.hasOwnProperty.call(message, "name"))
                        object.name = message.name;
                    if (message.desc != null && $Object.hasOwnProperty.call(message, "desc"))
                        object.desc = message.desc;
                    if (message.type != null && $Object.hasOwnProperty.call(message, "type"))
                        object.type = options.enums === $String ? $root.easemob.pb.MUCBody.Setting.Type[message.type] === $undefined ? message.type : $root.easemob.pb.MUCBody.Setting.Type[message.type] : message.type;
                    if (message.maxUsers != null && $Object.hasOwnProperty.call(message, "maxUsers"))
                        object.maxUsers = message.maxUsers;
                    if (message.owner != null && $Object.hasOwnProperty.call(message, "owner"))
                        object.owner = message.owner;
                    return object;
                };

                Setting.prototype.toJSON = function() {
                    return Setting.toObject(this, $protobuf.util.toJSONOptions);
                };

                Setting.getTypeUrl = function(prefix) {
                    if (prefix === $undefined)
                        prefix = "type.googleapis.com";
                    return prefix + "/easemob.pb.MUCBody.Setting";
                };

                Setting.Type = (function() {
                    const valuesById = $Object.create(null), values = $Object.create(valuesById);
                    values[valuesById[0] = "PRIVATE_OWNER_INVITE"] = 0;
                    values[valuesById[1] = "PRIVATE_MEMBER_INVITE"] = 1;
                    values[valuesById[2] = "PUBLIC_JOIN_APPROVAL"] = 2;
                    values[valuesById[3] = "PUBLIC_JOIN_OPEN"] = 3;
                    values[valuesById[4] = "PUBLIC_ANONYMOUS"] = 4;
                    return values;
                })();

                return Setting;
            })();

            MUCBody.Status = (function() {

                const Status = function (properties) {
                    if (properties)
                        for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                            if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                this[keys[i]] = properties[keys[i]];
                };

                Status.prototype.errorCode = 0;

                Status.prototype.description = "";

                Status.prototype.chatroomInfo = "";

                Status.create = function(properties) {
                    return new Status(properties);
                };

                Status.encode = function (message, writer, _depth) {
                    if (!writer)
                        writer = $Writer.create();
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $util.recursionLimit)
                        throw $Error("max depth exceeded");
                    if (message.errorCode != null && $Object.hasOwnProperty.call(message, "errorCode"))
                        writer.uint32(/* id 1, wireType 0 =*/8).int32(message.errorCode);
                    if (message.description != null && $Object.hasOwnProperty.call(message, "description"))
                        writer.uint32(/* id 2, wireType 2 =*/18).string(message.description);
                    if (message.chatroomInfo != null && $Object.hasOwnProperty.call(message, "chatroomInfo"))
                        writer.uint32(/* id 3, wireType 2 =*/26).string(message.chatroomInfo);
                    if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                        for (let i = 0; i < message.$unknowns.length; ++i)
                            writer.raw(message.$unknowns[i]);
                    return writer;
                };

                Status.encodeDelimited = function(message, writer) {
                    return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
                };

                Status.decode = function (reader, length, _end, _depth, _target) {
                    if (!(reader instanceof $Reader))
                        reader = $Reader.create(reader);
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $Reader.recursionLimit)
                        throw $Error("max depth exceeded");
                    let end, message, value;
                    if (length === $undefined)
                        end = reader.len;
                    else {
                        end = reader.pos + length;
                        if (end > reader.len)
                            throw $RangeError("index out of range");
                        length = reader.len;
                        reader.len = end;
                    }
                    message = _target || new $root.easemob.pb.MUCBody.Status();
                    while (reader.pos < end) {
                        let start = reader.pos;
                        let tag = reader.tag();
                        if (tag === _end) {
                            _end = $undefined;
                            break;
                        }
                        let wireType = tag & 7;
                        switch (tag >>>= 3) {
                        case 1: {
                                if (wireType !== 0)
                                    break;
                                value = reader.int32();
                                if ($root.easemob.pb.MUCBody.Status.ErrorCode[value] !== $undefined)
                                    message.errorCode = value;
                                else if (!reader.discardUnknown) {
                                    $util.makeProp(message, "$unknowns", false);
                                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                                }
                                continue;
                            }
                        case 2: {
                                if (wireType !== 2)
                                    break;
                                message.description = reader.string();
                                continue;
                            }
                        case 3: {
                                if (wireType !== 2)
                                    break;
                                message.chatroomInfo = reader.string();
                                continue;
                            }
                        }
                        reader.skipType(wireType, _depth, tag);
                        if (!reader.discardUnknown) {
                            $util.makeProp(message, "$unknowns", false);
                            (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                        }
                    }
                    if (length !== $undefined) {
                        if (reader.pos !== end)
                            throw $RangeError("index out of range");
                        reader.len = length;
                    }
                    if (_end !== $undefined)
                        throw $Error("missing end group");
                    return message;
                };

                Status.decodeDelimited = function(reader) {
                    if (!(reader instanceof $Reader))
                        reader = new $Reader(reader);
                    return this.decode(reader, reader.size());
                };

                Status.verify = function (message, _depth) {
                    if (typeof message !== "object" || message === null)
                        return "object expected";
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $util.recursionLimit)
                        return "max depth exceeded";
                    if (message.errorCode != null && $Object.hasOwnProperty.call(message, "errorCode"))
                        switch (message.errorCode) {
                        default:
                            return "errorCode: enum value expected";
                        case 0:
                        case 1:
                        case 2:
                        case 3:
                        case 4:
                        case 5:
                            break;
                        }
                    if (message.description != null && $Object.hasOwnProperty.call(message, "description"))
                        if (!$util.isString(message.description))
                            return "description: string expected";
                    if (message.chatroomInfo != null && $Object.hasOwnProperty.call(message, "chatroomInfo"))
                        if (!$util.isString(message.chatroomInfo))
                            return "chatroomInfo: string expected";
                    return null;
                };

                Status.fromObject = function (object, _depth) {
                    if (object instanceof $root.easemob.pb.MUCBody.Status)
                        return object;
                    if (!$util.isObject(object))
                        throw $TypeError(".easemob.pb.MUCBody.Status: object expected");
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $util.recursionLimit)
                        throw $Error("max depth exceeded");
                    let message = new $root.easemob.pb.MUCBody.Status();
                    switch (object.errorCode) {
                    case "OK":
                    case 0:
                        message.errorCode = 0;
                        break;
                    case "PERMISSION_DENIED":
                    case 1:
                        message.errorCode = 1;
                        break;
                    case "WRONG_PARAMETER":
                    case 2:
                        message.errorCode = 2;
                        break;
                    case "MUC_NOT_EXIST":
                    case 3:
                        message.errorCode = 3;
                        break;
                    case "USER_NOT_EXIST":
                    case 4:
                        message.errorCode = 4;
                        break;
                    case "UNKNOWN":
                    case 5:
                        message.errorCode = 5;
                        break;
                    default:
                    }
                    if (object.description != null)
                        message.description = $String(object.description);
                    if (object.chatroomInfo != null)
                        message.chatroomInfo = $String(object.chatroomInfo);
                    return message;
                };

                Status.toObject = function (message, options, _depth) {
                    if (!options)
                        options = {};
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $util.recursionLimit)
                        throw $Error("max depth exceeded");
                    let object = {};
                    if (options.defaults) {
                        object.errorCode = options.enums === $String ? "OK" : 0;
                        object.description = "";
                        object.chatroomInfo = "";
                    }
                    if (message.errorCode != null && $Object.hasOwnProperty.call(message, "errorCode"))
                        object.errorCode = options.enums === $String ? $root.easemob.pb.MUCBody.Status.ErrorCode[message.errorCode] === $undefined ? message.errorCode : $root.easemob.pb.MUCBody.Status.ErrorCode[message.errorCode] : message.errorCode;
                    if (message.description != null && $Object.hasOwnProperty.call(message, "description"))
                        object.description = message.description;
                    if (message.chatroomInfo != null && $Object.hasOwnProperty.call(message, "chatroomInfo"))
                        object.chatroomInfo = message.chatroomInfo;
                    return object;
                };

                Status.prototype.toJSON = function() {
                    return Status.toObject(this, $protobuf.util.toJSONOptions);
                };

                Status.getTypeUrl = function(prefix) {
                    if (prefix === $undefined)
                        prefix = "type.googleapis.com";
                    return prefix + "/easemob.pb.MUCBody.Status";
                };

                Status.ErrorCode = (function() {
                    const valuesById = $Object.create(null), values = $Object.create(valuesById);
                    values[valuesById[0] = "OK"] = 0;
                    values[valuesById[1] = "PERMISSION_DENIED"] = 1;
                    values[valuesById[2] = "WRONG_PARAMETER"] = 2;
                    values[valuesById[3] = "MUC_NOT_EXIST"] = 3;
                    values[valuesById[4] = "USER_NOT_EXIST"] = 4;
                    values[valuesById[5] = "UNKNOWN"] = 5;
                    return values;
                })();

                return Status;
            })();

            MUCBody.EventInfo = (function() {

                const EventInfo = function (properties) {
                    if (properties)
                        for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                            if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                this[keys[i]] = properties[keys[i]];
                };

                EventInfo.prototype.eventType = 0;

                EventInfo.prototype.ext = "";

                EventInfo.create = function(properties) {
                    return new EventInfo(properties);
                };

                EventInfo.encode = function (message, writer, _depth) {
                    if (!writer)
                        writer = $Writer.create();
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $util.recursionLimit)
                        throw $Error("max depth exceeded");
                    if (message.eventType != null && $Object.hasOwnProperty.call(message, "eventType"))
                        writer.uint32(/* id 1, wireType 0 =*/8).int32(message.eventType);
                    if (message.ext != null && $Object.hasOwnProperty.call(message, "ext"))
                        writer.uint32(/* id 2, wireType 2 =*/18).string(message.ext);
                    if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                        for (let i = 0; i < message.$unknowns.length; ++i)
                            writer.raw(message.$unknowns[i]);
                    return writer;
                };

                EventInfo.encodeDelimited = function(message, writer) {
                    return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
                };

                EventInfo.decode = function (reader, length, _end, _depth, _target) {
                    if (!(reader instanceof $Reader))
                        reader = $Reader.create(reader);
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $Reader.recursionLimit)
                        throw $Error("max depth exceeded");
                    let end, message, value;
                    if (length === $undefined)
                        end = reader.len;
                    else {
                        end = reader.pos + length;
                        if (end > reader.len)
                            throw $RangeError("index out of range");
                        length = reader.len;
                        reader.len = end;
                    }
                    message = _target || new $root.easemob.pb.MUCBody.EventInfo();
                    while (reader.pos < end) {
                        let start = reader.pos;
                        let tag = reader.tag();
                        if (tag === _end) {
                            _end = $undefined;
                            break;
                        }
                        let wireType = tag & 7;
                        switch (tag >>>= 3) {
                        case 1: {
                                if (wireType !== 0)
                                    break;
                                value = reader.int32();
                                if ($root.easemob.pb.MUCBody.EventInfo.EventType[value] !== $undefined)
                                    message.eventType = value;
                                else if (!reader.discardUnknown) {
                                    $util.makeProp(message, "$unknowns", false);
                                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                                }
                                continue;
                            }
                        case 2: {
                                if (wireType !== 2)
                                    break;
                                message.ext = reader.string();
                                continue;
                            }
                        }
                        reader.skipType(wireType, _depth, tag);
                        if (!reader.discardUnknown) {
                            $util.makeProp(message, "$unknowns", false);
                            (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                        }
                    }
                    if (length !== $undefined) {
                        if (reader.pos !== end)
                            throw $RangeError("index out of range");
                        reader.len = length;
                    }
                    if (_end !== $undefined)
                        throw $Error("missing end group");
                    return message;
                };

                EventInfo.decodeDelimited = function(reader) {
                    if (!(reader instanceof $Reader))
                        reader = new $Reader(reader);
                    return this.decode(reader, reader.size());
                };

                EventInfo.verify = function (message, _depth) {
                    if (typeof message !== "object" || message === null)
                        return "object expected";
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $util.recursionLimit)
                        return "max depth exceeded";
                    if (message.eventType != null && $Object.hasOwnProperty.call(message, "eventType"))
                        switch (message.eventType) {
                        default:
                            return "eventType: enum value expected";
                        case 0:
                        case 1:
                            break;
                        }
                    if (message.ext != null && $Object.hasOwnProperty.call(message, "ext"))
                        if (!$util.isString(message.ext))
                            return "ext: string expected";
                    return null;
                };

                EventInfo.fromObject = function (object, _depth) {
                    if (object instanceof $root.easemob.pb.MUCBody.EventInfo)
                        return object;
                    if (!$util.isObject(object))
                        throw $TypeError(".easemob.pb.MUCBody.EventInfo: object expected");
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $util.recursionLimit)
                        throw $Error("max depth exceeded");
                    let message = new $root.easemob.pb.MUCBody.EventInfo();
                    switch (object.eventType) {
                    case "EVENT_NONE":
                    case 0:
                        message.eventType = 0;
                        break;
                    case "CIRCLE_CHANNEL":
                    case 1:
                        message.eventType = 1;
                        break;
                    default:
                    }
                    if (object.ext != null)
                        message.ext = $String(object.ext);
                    return message;
                };

                EventInfo.toObject = function (message, options, _depth) {
                    if (!options)
                        options = {};
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $util.recursionLimit)
                        throw $Error("max depth exceeded");
                    let object = {};
                    if (options.defaults) {
                        object.eventType = options.enums === $String ? "EVENT_NONE" : 0;
                        object.ext = "";
                    }
                    if (message.eventType != null && $Object.hasOwnProperty.call(message, "eventType"))
                        object.eventType = options.enums === $String ? $root.easemob.pb.MUCBody.EventInfo.EventType[message.eventType] === $undefined ? message.eventType : $root.easemob.pb.MUCBody.EventInfo.EventType[message.eventType] : message.eventType;
                    if (message.ext != null && $Object.hasOwnProperty.call(message, "ext"))
                        object.ext = message.ext;
                    return object;
                };

                EventInfo.prototype.toJSON = function() {
                    return EventInfo.toObject(this, $protobuf.util.toJSONOptions);
                };

                EventInfo.getTypeUrl = function(prefix) {
                    if (prefix === $undefined)
                        prefix = "type.googleapis.com";
                    return prefix + "/easemob.pb.MUCBody.EventInfo";
                };

                EventInfo.EventType = (function() {
                    const valuesById = $Object.create(null), values = $Object.create(valuesById);
                    values[valuesById[0] = "EVENT_NONE"] = 0;
                    values[valuesById[1] = "CIRCLE_CHANNEL"] = 1;
                    return values;
                })();

                return EventInfo;
            })();

            return MUCBody;
        })();

        pb.RosterBody = (function() {

            const RosterBody = function (properties) {
                this.to = [];
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            RosterBody.prototype.operation = 0;

            RosterBody.prototype.status = null;

            RosterBody.prototype.from = null;

            RosterBody.prototype.to = $util.emptyArray;

            RosterBody.prototype.reason = "";

            RosterBody.prototype.rosterVer = "";

            RosterBody.prototype.biDirection = false;

            RosterBody.create = function(properties) {
                return new RosterBody(properties);
            };

            RosterBody.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                if (message.operation != null && $Object.hasOwnProperty.call(message, "operation"))
                    writer.uint32(/* id 1, wireType 0 =*/8).int32(message.operation);
                if (message.status != null && $Object.hasOwnProperty.call(message, "status"))
                    $root.easemob.pb.RosterBody.Status.encode(message.status, writer.uint32(/* id 2, wireType 2 =*/18).fork(), _depth + 1).ldelim();
                if (message.from != null && $Object.hasOwnProperty.call(message, "from"))
                    $root.easemob.pb.JID.encode(message.from, writer.uint32(/* id 3, wireType 2 =*/26).fork(), _depth + 1).ldelim();
                if (message.to != null && message.to.length)
                    for (let i = 0; i < message.to.length; ++i)
                        $root.easemob.pb.JID.encode(message.to[i], writer.uint32(/* id 4, wireType 2 =*/34).fork(), _depth + 1).ldelim();
                if (message.reason != null && $Object.hasOwnProperty.call(message, "reason"))
                    writer.uint32(/* id 5, wireType 2 =*/42).string(message.reason);
                if (message.rosterVer != null && $Object.hasOwnProperty.call(message, "rosterVer"))
                    writer.uint32(/* id 6, wireType 2 =*/50).string(message.rosterVer);
                if (message.biDirection != null && $Object.hasOwnProperty.call(message, "biDirection"))
                    writer.uint32(/* id 7, wireType 0 =*/56).bool(message.biDirection);
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            RosterBody.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            RosterBody.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end, message, value;
                if (length === $undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw $RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = _target || new $root.easemob.pb.RosterBody();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType !== 0)
                                break;
                            value = reader.int32();
                            if ($root.easemob.pb.RosterBody.Operation[value] !== $undefined)
                                message.operation = value;
                            else if (!reader.discardUnknown) {
                                $util.makeProp(message, "$unknowns", false);
                                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                            }
                            continue;
                        }
                    case 2: {
                            if (wireType !== 2)
                                break;
                            message.status = $root.easemob.pb.RosterBody.Status.decode(reader, reader.size(), $undefined, _depth + 1, message.status);
                            continue;
                        }
                    case 3: {
                            if (wireType !== 2)
                                break;
                            message.from = $root.easemob.pb.JID.decode(reader, reader.size(), $undefined, _depth + 1, message.from);
                            continue;
                        }
                    case 4: {
                            if (wireType !== 2)
                                break;
                            if (!(message.to && message.to.length))
                                message.to = [];
                            message.to.push($root.easemob.pb.JID.decode(reader, reader.size(), $undefined, _depth + 1));
                            continue;
                        }
                    case 5: {
                            if (wireType !== 2)
                                break;
                            message.reason = reader.string();
                            continue;
                        }
                    case 6: {
                            if (wireType !== 2)
                                break;
                            message.rosterVer = reader.string();
                            continue;
                        }
                    case 7: {
                            if (wireType !== 0)
                                break;
                            message.biDirection = reader.bool();
                            continue;
                        }
                    }
                    reader.skipType(wireType, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (length !== $undefined) {
                    if (reader.pos !== end)
                        throw $RangeError("index out of range");
                    reader.len = length;
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                return message;
            };

            RosterBody.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.size());
            };

            RosterBody.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                if (message.operation != null && $Object.hasOwnProperty.call(message, "operation"))
                    switch (message.operation) {
                    default:
                        return "operation: enum value expected";
                    case 0:
                    case 1:
                    case 2:
                    case 3:
                    case 4:
                    case 5:
                    case 6:
                    case 7:
                    case 8:
                    case 9:
                        break;
                    }
                if (message.status != null && $Object.hasOwnProperty.call(message, "status")) {
                    let error = $root.easemob.pb.RosterBody.Status.verify(message.status, _depth + 1);
                    if (error)
                        return "status." + error;
                }
                if (message.from != null && $Object.hasOwnProperty.call(message, "from")) {
                    let error = $root.easemob.pb.JID.verify(message.from, _depth + 1);
                    if (error)
                        return "from." + error;
                }
                if (message.to != null && $Object.hasOwnProperty.call(message, "to")) {
                    if (!$Array.isArray(message.to))
                        return "to: array expected";
                    for (let i = 0; i < message.to.length; ++i) {
                        let error = $root.easemob.pb.JID.verify(message.to[i], _depth + 1);
                        if (error)
                            return "to." + error;
                    }
                }
                if (message.reason != null && $Object.hasOwnProperty.call(message, "reason"))
                    if (!$util.isString(message.reason))
                        return "reason: string expected";
                if (message.rosterVer != null && $Object.hasOwnProperty.call(message, "rosterVer"))
                    if (!$util.isString(message.rosterVer))
                        return "rosterVer: string expected";
                if (message.biDirection != null && $Object.hasOwnProperty.call(message, "biDirection"))
                    if (typeof message.biDirection !== "boolean")
                        return "biDirection: boolean expected";
                return null;
            };

            RosterBody.fromObject = function (object, _depth) {
                if (object instanceof $root.easemob.pb.RosterBody)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".easemob.pb.RosterBody: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let message = new $root.easemob.pb.RosterBody();
                switch (object.operation) {
                case "GET_ROSTER":
                case 0:
                    message.operation = 0;
                    break;
                case "GET_BLACKLIST":
                case 1:
                    message.operation = 1;
                    break;
                case "ADD":
                case 2:
                    message.operation = 2;
                    break;
                case "REMOVE":
                case 3:
                    message.operation = 3;
                    break;
                case "ACCEPT":
                case 4:
                    message.operation = 4;
                    break;
                case "DECLINE":
                case 5:
                    message.operation = 5;
                    break;
                case "BAN":
                case 6:
                    message.operation = 6;
                    break;
                case "ALLOW":
                case 7:
                    message.operation = 7;
                    break;
                case "REMOTE_ACCEPT":
                case 8:
                    message.operation = 8;
                    break;
                case "REMOTE_DECLINE":
                case 9:
                    message.operation = 9;
                    break;
                default:
                }
                if (object.status != null) {
                    if (!$util.isObject(object.status))
                        throw $TypeError(".easemob.pb.RosterBody.status: object expected");
                    message.status = $root.easemob.pb.RosterBody.Status.fromObject(object.status, _depth + 1);
                }
                if (object.from != null) {
                    if (!$util.isObject(object.from))
                        throw $TypeError(".easemob.pb.RosterBody.from: object expected");
                    message.from = $root.easemob.pb.JID.fromObject(object.from, _depth + 1);
                }
                if (object.to) {
                    if (!$Array.isArray(object.to))
                        throw $TypeError(".easemob.pb.RosterBody.to: array expected");
                    message.to = $Array(object.to.length);
                    for (let i = 0; i < object.to.length; ++i) {
                        if (!$util.isObject(object.to[i]))
                            throw $TypeError(".easemob.pb.RosterBody.to: object expected");
                        message.to[i] = $root.easemob.pb.JID.fromObject(object.to[i], _depth + 1);
                    }
                }
                if (object.reason != null)
                    message.reason = $String(object.reason);
                if (object.rosterVer != null)
                    message.rosterVer = $String(object.rosterVer);
                if (object.biDirection != null)
                    message.biDirection = $Boolean(object.biDirection);
                return message;
            };

            RosterBody.toObject = function (message, options, _depth) {
                if (!options)
                    options = {};
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let object = {};
                if (options.arrays || options.defaults)
                    object.to = [];
                if (options.defaults) {
                    object.operation = options.enums === $String ? "GET_ROSTER" : 0;
                    object.status = null;
                    object.from = null;
                    object.reason = "";
                    object.rosterVer = "";
                    object.biDirection = false;
                }
                if (message.operation != null && $Object.hasOwnProperty.call(message, "operation"))
                    object.operation = options.enums === $String ? $root.easemob.pb.RosterBody.Operation[message.operation] === $undefined ? message.operation : $root.easemob.pb.RosterBody.Operation[message.operation] : message.operation;
                if (message.status != null && $Object.hasOwnProperty.call(message, "status"))
                    object.status = $root.easemob.pb.RosterBody.Status.toObject(message.status, options, _depth + 1);
                if (message.from != null && $Object.hasOwnProperty.call(message, "from"))
                    object.from = $root.easemob.pb.JID.toObject(message.from, options, _depth + 1);
                if (message.to && message.to.length) {
                    object.to = $Array(message.to.length);
                    for (let j = 0; j < message.to.length; ++j)
                        object.to[j] = $root.easemob.pb.JID.toObject(message.to[j], options, _depth + 1);
                }
                if (message.reason != null && $Object.hasOwnProperty.call(message, "reason"))
                    object.reason = message.reason;
                if (message.rosterVer != null && $Object.hasOwnProperty.call(message, "rosterVer"))
                    object.rosterVer = message.rosterVer;
                if (message.biDirection != null && $Object.hasOwnProperty.call(message, "biDirection"))
                    object.biDirection = message.biDirection;
                return object;
            };

            RosterBody.prototype.toJSON = function() {
                return RosterBody.toObject(this, $protobuf.util.toJSONOptions);
            };

            RosterBody.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/easemob.pb.RosterBody";
            };

            RosterBody.Operation = (function() {
                const valuesById = $Object.create(null), values = $Object.create(valuesById);
                values[valuesById[0] = "GET_ROSTER"] = 0;
                values[valuesById[1] = "GET_BLACKLIST"] = 1;
                values[valuesById[2] = "ADD"] = 2;
                values[valuesById[3] = "REMOVE"] = 3;
                values[valuesById[4] = "ACCEPT"] = 4;
                values[valuesById[5] = "DECLINE"] = 5;
                values[valuesById[6] = "BAN"] = 6;
                values[valuesById[7] = "ALLOW"] = 7;
                values[valuesById[8] = "REMOTE_ACCEPT"] = 8;
                values[valuesById[9] = "REMOTE_DECLINE"] = 9;
                return values;
            })();

            RosterBody.Status = (function() {

                const Status = function (properties) {
                    if (properties)
                        for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                            if (properties[keys[i]] != null && keys[i] !== "__proto__")
                                this[keys[i]] = properties[keys[i]];
                };

                Status.prototype.errorCode = 0;

                Status.prototype.description = "";

                Status.create = function(properties) {
                    return new Status(properties);
                };

                Status.encode = function (message, writer, _depth) {
                    if (!writer)
                        writer = $Writer.create();
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $util.recursionLimit)
                        throw $Error("max depth exceeded");
                    if (message.errorCode != null && $Object.hasOwnProperty.call(message, "errorCode"))
                        writer.uint32(/* id 1, wireType 0 =*/8).int32(message.errorCode);
                    if (message.description != null && $Object.hasOwnProperty.call(message, "description"))
                        writer.uint32(/* id 2, wireType 2 =*/18).string(message.description);
                    if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                        for (let i = 0; i < message.$unknowns.length; ++i)
                            writer.raw(message.$unknowns[i]);
                    return writer;
                };

                Status.encodeDelimited = function(message, writer) {
                    return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
                };

                Status.decode = function (reader, length, _end, _depth, _target) {
                    if (!(reader instanceof $Reader))
                        reader = $Reader.create(reader);
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $Reader.recursionLimit)
                        throw $Error("max depth exceeded");
                    let end, message, value;
                    if (length === $undefined)
                        end = reader.len;
                    else {
                        end = reader.pos + length;
                        if (end > reader.len)
                            throw $RangeError("index out of range");
                        length = reader.len;
                        reader.len = end;
                    }
                    message = _target || new $root.easemob.pb.RosterBody.Status();
                    while (reader.pos < end) {
                        let start = reader.pos;
                        let tag = reader.tag();
                        if (tag === _end) {
                            _end = $undefined;
                            break;
                        }
                        let wireType = tag & 7;
                        switch (tag >>>= 3) {
                        case 1: {
                                if (wireType !== 0)
                                    break;
                                value = reader.int32();
                                if ($root.easemob.pb.RosterBody.Status.ErrorCode[value] !== $undefined)
                                    message.errorCode = value;
                                else if (!reader.discardUnknown) {
                                    $util.makeProp(message, "$unknowns", false);
                                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                                }
                                continue;
                            }
                        case 2: {
                                if (wireType !== 2)
                                    break;
                                message.description = reader.string();
                                continue;
                            }
                        }
                        reader.skipType(wireType, _depth, tag);
                        if (!reader.discardUnknown) {
                            $util.makeProp(message, "$unknowns", false);
                            (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                        }
                    }
                    if (length !== $undefined) {
                        if (reader.pos !== end)
                            throw $RangeError("index out of range");
                        reader.len = length;
                    }
                    if (_end !== $undefined)
                        throw $Error("missing end group");
                    return message;
                };

                Status.decodeDelimited = function(reader) {
                    if (!(reader instanceof $Reader))
                        reader = new $Reader(reader);
                    return this.decode(reader, reader.size());
                };

                Status.verify = function (message, _depth) {
                    if (typeof message !== "object" || message === null)
                        return "object expected";
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $util.recursionLimit)
                        return "max depth exceeded";
                    if (message.errorCode != null && $Object.hasOwnProperty.call(message, "errorCode"))
                        switch (message.errorCode) {
                        default:
                            return "errorCode: enum value expected";
                        case 0:
                        case 1:
                        case 2:
                        case 3:
                            break;
                        }
                    if (message.description != null && $Object.hasOwnProperty.call(message, "description"))
                        if (!$util.isString(message.description))
                            return "description: string expected";
                    return null;
                };

                Status.fromObject = function (object, _depth) {
                    if (object instanceof $root.easemob.pb.RosterBody.Status)
                        return object;
                    if (!$util.isObject(object))
                        throw $TypeError(".easemob.pb.RosterBody.Status: object expected");
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $util.recursionLimit)
                        throw $Error("max depth exceeded");
                    let message = new $root.easemob.pb.RosterBody.Status();
                    switch (object.errorCode) {
                    case "OK":
                    case 0:
                        message.errorCode = 0;
                        break;
                    case "USER_NOT_EXIST":
                    case 1:
                        message.errorCode = 1;
                        break;
                    case "USER_ALREADY_FRIEND":
                    case 2:
                        message.errorCode = 2;
                        break;
                    case "USER_ALREADY_BLACKLIST":
                    case 3:
                        message.errorCode = 3;
                        break;
                    default:
                    }
                    if (object.description != null)
                        message.description = $String(object.description);
                    return message;
                };

                Status.toObject = function (message, options, _depth) {
                    if (!options)
                        options = {};
                    if (_depth === $undefined)
                        _depth = 0;
                    if (_depth > $util.recursionLimit)
                        throw $Error("max depth exceeded");
                    let object = {};
                    if (options.defaults) {
                        object.errorCode = options.enums === $String ? "OK" : 0;
                        object.description = "";
                    }
                    if (message.errorCode != null && $Object.hasOwnProperty.call(message, "errorCode"))
                        object.errorCode = options.enums === $String ? $root.easemob.pb.RosterBody.Status.ErrorCode[message.errorCode] === $undefined ? message.errorCode : $root.easemob.pb.RosterBody.Status.ErrorCode[message.errorCode] : message.errorCode;
                    if (message.description != null && $Object.hasOwnProperty.call(message, "description"))
                        object.description = message.description;
                    return object;
                };

                Status.prototype.toJSON = function() {
                    return Status.toObject(this, $protobuf.util.toJSONOptions);
                };

                Status.getTypeUrl = function(prefix) {
                    if (prefix === $undefined)
                        prefix = "type.googleapis.com";
                    return prefix + "/easemob.pb.RosterBody.Status";
                };

                Status.ErrorCode = (function() {
                    const valuesById = $Object.create(null), values = $Object.create(valuesById);
                    values[valuesById[0] = "OK"] = 0;
                    values[valuesById[1] = "USER_NOT_EXIST"] = 1;
                    values[valuesById[2] = "USER_ALREADY_FRIEND"] = 2;
                    values[valuesById[3] = "USER_ALREADY_BLACKLIST"] = 3;
                    return values;
                })();

                return Status;
            })();

            return RosterBody;
        })();

        pb.StatisticsBody = (function() {

            const StatisticsBody = function (properties) {
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            StatisticsBody.prototype.operation = 0;

            StatisticsBody.prototype.os = 0;

            StatisticsBody.prototype.version = "";

            StatisticsBody.prototype.network = 0;

            StatisticsBody.prototype.imTime = 0;

            StatisticsBody.prototype.chatTime = 0;

            StatisticsBody.prototype.location = "";

            StatisticsBody.prototype.reason = "";

            StatisticsBody.create = function(properties) {
                return new StatisticsBody(properties);
            };

            StatisticsBody.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                if (message.operation != null && $Object.hasOwnProperty.call(message, "operation"))
                    writer.uint32(/* id 1, wireType 0 =*/8).int32(message.operation);
                if (message.os != null && $Object.hasOwnProperty.call(message, "os"))
                    writer.uint32(/* id 2, wireType 0 =*/16).int32(message.os);
                if (message.version != null && $Object.hasOwnProperty.call(message, "version"))
                    writer.uint32(/* id 3, wireType 2 =*/26).string(message.version);
                if (message.network != null && $Object.hasOwnProperty.call(message, "network"))
                    writer.uint32(/* id 4, wireType 0 =*/32).int32(message.network);
                if (message.imTime != null && $Object.hasOwnProperty.call(message, "imTime"))
                    writer.uint32(/* id 5, wireType 0 =*/40).uint32(message.imTime);
                if (message.chatTime != null && $Object.hasOwnProperty.call(message, "chatTime"))
                    writer.uint32(/* id 6, wireType 0 =*/48).uint32(message.chatTime);
                if (message.location != null && $Object.hasOwnProperty.call(message, "location"))
                    writer.uint32(/* id 7, wireType 2 =*/58).string(message.location);
                if (message.reason != null && $Object.hasOwnProperty.call(message, "reason"))
                    writer.uint32(/* id 10, wireType 2 =*/82).string(message.reason);
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            StatisticsBody.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            StatisticsBody.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end, message, value;
                if (length === $undefined)
                    end = reader.len;
                else {
                    end = reader.pos + length;
                    if (end > reader.len)
                        throw $RangeError("index out of range");
                    length = reader.len;
                    reader.len = end;
                }
                message = _target || new $root.easemob.pb.StatisticsBody();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType !== 0)
                                break;
                            value = reader.int32();
                            if ($root.easemob.pb.StatisticsBody.Operation[value] !== $undefined)
                                message.operation = value;
                            else if (!reader.discardUnknown) {
                                $util.makeProp(message, "$unknowns", false);
                                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                            }
                            continue;
                        }
                    case 2: {
                            if (wireType !== 0)
                                break;
                            value = reader.int32();
                            if ($root.easemob.pb.StatisticsBody.OsType[value] !== $undefined)
                                message.os = value;
                            else if (!reader.discardUnknown) {
                                $util.makeProp(message, "$unknowns", false);
                                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                            }
                            continue;
                        }
                    case 3: {
                            if (wireType !== 2)
                                break;
                            message.version = reader.string();
                            continue;
                        }
                    case 4: {
                            if (wireType !== 0)
                                break;
                            value = reader.int32();
                            if ($root.easemob.pb.StatisticsBody.NetworkType[value] !== $undefined)
                                message.network = value;
                            else if (!reader.discardUnknown) {
                                $util.makeProp(message, "$unknowns", false);
                                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                            }
                            continue;
                        }
                    case 5: {
                            if (wireType !== 0)
                                break;
                            message.imTime = reader.uint32();
                            continue;
                        }
                    case 6: {
                            if (wireType !== 0)
                                break;
                            message.chatTime = reader.uint32();
                            continue;
                        }
                    case 7: {
                            if (wireType !== 2)
                                break;
                            message.location = reader.string();
                            continue;
                        }
                    case 10: {
                            if (wireType !== 2)
                                break;
                            message.reason = reader.string();
                            continue;
                        }
                    }
                    reader.skipType(wireType, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (length !== $undefined) {
                    if (reader.pos !== end)
                        throw $RangeError("index out of range");
                    reader.len = length;
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                return message;
            };

            StatisticsBody.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.size());
            };

            StatisticsBody.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                if (message.operation != null && $Object.hasOwnProperty.call(message, "operation"))
                    switch (message.operation) {
                    default:
                        return "operation: enum value expected";
                    case 0:
                    case 1:
                    case 2:
                    case 3:
                    case 4:
                        break;
                    }
                if (message.os != null && $Object.hasOwnProperty.call(message, "os"))
                    switch (message.os) {
                    default:
                        return "os: enum value expected";
                    case 0:
                    case 1:
                    case 2:
                    case 3:
                    case 4:
                    case 5:
                    case 16:
                        break;
                    }
                if (message.version != null && $Object.hasOwnProperty.call(message, "version"))
                    if (!$util.isString(message.version))
                        return "version: string expected";
                if (message.network != null && $Object.hasOwnProperty.call(message, "network"))
                    switch (message.network) {
                    default:
                        return "network: enum value expected";
                    case 0:
                    case 1:
                    case 2:
                    case 3:
                    case 4:
                    case 5:
                        break;
                    }
                if (message.imTime != null && $Object.hasOwnProperty.call(message, "imTime"))
                    if (!$util.isInteger(message.imTime))
                        return "imTime: integer expected";
                if (message.chatTime != null && $Object.hasOwnProperty.call(message, "chatTime"))
                    if (!$util.isInteger(message.chatTime))
                        return "chatTime: integer expected";
                if (message.location != null && $Object.hasOwnProperty.call(message, "location"))
                    if (!$util.isString(message.location))
                        return "location: string expected";
                if (message.reason != null && $Object.hasOwnProperty.call(message, "reason"))
                    if (!$util.isString(message.reason))
                        return "reason: string expected";
                return null;
            };

            StatisticsBody.fromObject = function (object, _depth) {
                if (object instanceof $root.easemob.pb.StatisticsBody)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".easemob.pb.StatisticsBody: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let message = new $root.easemob.pb.StatisticsBody();
                switch (object.operation) {
                case "INFORMATION":
                case 0:
                    message.operation = 0;
                    break;
                case "USER_REMOVED":
                case 1:
                    message.operation = 1;
                    break;
                case "USER_LOGIN_ANOTHER_DEVICE":
                case 2:
                    message.operation = 2;
                    break;
                case "USER_KICKED_BY_CHANGE_PASSWORD":
                case 3:
                    message.operation = 3;
                    break;
                case "USER_KICKED_BY_OTHER_DEVICE":
                case 4:
                    message.operation = 4;
                    break;
                default:
                }
                switch (object.os) {
                case "OS_IOS":
                case 0:
                    message.os = 0;
                    break;
                case "OS_ANDROID":
                case 1:
                    message.os = 1;
                    break;
                case "OS_LINUX":
                case 2:
                    message.os = 2;
                    break;
                case "OS_OSX":
                case 3:
                    message.os = 3;
                    break;
                case "OS_WIN":
                case 4:
                    message.os = 4;
                    break;
                case "OS_CUSTOM":
                case 5:
                    message.os = 5;
                    break;
                case "OS_OTHER":
                case 16:
                    message.os = 16;
                    break;
                default:
                }
                if (object.version != null)
                    message.version = $String(object.version);
                switch (object.network) {
                case "NETWORK_NONE":
                case 0:
                    message.network = 0;
                    break;
                case "NETWORK_WIFI":
                case 1:
                    message.network = 1;
                    break;
                case "NETWORK_4G":
                case 2:
                    message.network = 2;
                    break;
                case "NETWORK_3G":
                case 3:
                    message.network = 3;
                    break;
                case "NETWORK_2G":
                case 4:
                    message.network = 4;
                    break;
                case "NETWORK_WIRE":
                case 5:
                    message.network = 5;
                    break;
                default:
                }
                if (object.imTime != null)
                    message.imTime = object.imTime >>> 0;
                if (object.chatTime != null)
                    message.chatTime = object.chatTime >>> 0;
                if (object.location != null)
                    message.location = $String(object.location);
                if (object.reason != null)
                    message.reason = $String(object.reason);
                return message;
            };

            StatisticsBody.toObject = function (message, options, _depth) {
                if (!options)
                    options = {};
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let object = {};
                if (options.defaults) {
                    object.operation = options.enums === $String ? "INFORMATION" : 0;
                    object.os = options.enums === $String ? "OS_IOS" : 0;
                    object.version = "";
                    object.network = options.enums === $String ? "NETWORK_NONE" : 0;
                    object.imTime = 0;
                    object.chatTime = 0;
                    object.location = "";
                    object.reason = "";
                }
                if (message.operation != null && $Object.hasOwnProperty.call(message, "operation"))
                    object.operation = options.enums === $String ? $root.easemob.pb.StatisticsBody.Operation[message.operation] === $undefined ? message.operation : $root.easemob.pb.StatisticsBody.Operation[message.operation] : message.operation;
                if (message.os != null && $Object.hasOwnProperty.call(message, "os"))
                    object.os = options.enums === $String ? $root.easemob.pb.StatisticsBody.OsType[message.os] === $undefined ? message.os : $root.easemob.pb.StatisticsBody.OsType[message.os] : message.os;
                if (message.version != null && $Object.hasOwnProperty.call(message, "version"))
                    object.version = message.version;
                if (message.network != null && $Object.hasOwnProperty.call(message, "network"))
                    object.network = options.enums === $String ? $root.easemob.pb.StatisticsBody.NetworkType[message.network] === $undefined ? message.network : $root.easemob.pb.StatisticsBody.NetworkType[message.network] : message.network;
                if (message.imTime != null && $Object.hasOwnProperty.call(message, "imTime"))
                    object.imTime = message.imTime;
                if (message.chatTime != null && $Object.hasOwnProperty.call(message, "chatTime"))
                    object.chatTime = message.chatTime;
                if (message.location != null && $Object.hasOwnProperty.call(message, "location"))
                    object.location = message.location;
                if (message.reason != null && $Object.hasOwnProperty.call(message, "reason"))
                    object.reason = message.reason;
                return object;
            };

            StatisticsBody.prototype.toJSON = function() {
                return StatisticsBody.toObject(this, $protobuf.util.toJSONOptions);
            };

            StatisticsBody.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/easemob.pb.StatisticsBody";
            };

            StatisticsBody.Operation = (function() {
                const valuesById = $Object.create(null), values = $Object.create(valuesById);
                values[valuesById[0] = "INFORMATION"] = 0;
                values[valuesById[1] = "USER_REMOVED"] = 1;
                values[valuesById[2] = "USER_LOGIN_ANOTHER_DEVICE"] = 2;
                values[valuesById[3] = "USER_KICKED_BY_CHANGE_PASSWORD"] = 3;
                values[valuesById[4] = "USER_KICKED_BY_OTHER_DEVICE"] = 4;
                return values;
            })();

            StatisticsBody.OsType = (function() {
                const valuesById = $Object.create(null), values = $Object.create(valuesById);
                values[valuesById[0] = "OS_IOS"] = 0;
                values[valuesById[1] = "OS_ANDROID"] = 1;
                values[valuesById[2] = "OS_LINUX"] = 2;
                values[valuesById[3] = "OS_OSX"] = 3;
                values[valuesById[4] = "OS_WIN"] = 4;
                values[valuesById[5] = "OS_CUSTOM"] = 5;
                values[valuesById[16] = "OS_OTHER"] = 16;
                return values;
            })();

            StatisticsBody.NetworkType = (function() {
                const valuesById = $Object.create(null), values = $Object.create(valuesById);
                values[valuesById[0] = "NETWORK_NONE"] = 0;
                values[valuesById[1] = "NETWORK_WIFI"] = 1;
                values[valuesById[2] = "NETWORK_4G"] = 2;
                values[valuesById[3] = "NETWORK_3G"] = 3;
                values[valuesById[4] = "NETWORK_2G"] = 4;
                values[valuesById[5] = "NETWORK_WIRE"] = 5;
                return values;
            })();

            return StatisticsBody;
        })();

        return pb;
    })();

    return easemob;
})();

export {
  $root as default
};
