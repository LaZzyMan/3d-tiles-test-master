(function () {
    //加载底图资源
    var osm = Cesium.createOpenStreetMapImageryProvider({
        url : 'https://a.tile.openstreetmap.org/'
    });
    //配置Cesium Viewer相关设置
    //创建Cesium Viewer
    var viewer = new Cesium.Viewer('cesiumContainer', {
        scene3DOnly : true,
        baseLayerPicker:false,
        imageryProvider:osm,
        vrButton:true
    });
    //设置home键camera中心位置
    viewer.homeButton.viewModel.command.beforeExecute.addEventListener(function(commandInfo){
        //Zoom to custom extent
        viewer.camera.flyTo({
            destination : new Cesium.Cartesian3(978703.4032039205, -5664709.285048889, 2754627.305272117),
            orientation : {
                direction : new Cesium.Cartesian3(0.33506436388093397, 0.7178758873584659, 0.6102344487214404),
                up : new Cesium.Cartesian3(0.27649053726026684, -0.6940744040291643, 0.6646906833084766)
            }
        });
        commandInfo.cancel = true;
    });
    //设置场景效果
    var scene = viewer.scene;
    scene.fog.enabled = false;
    scene.debugShowFramesPerSecond = true;
    //获得屏幕焦点
    var canvas = viewer.canvas;
    canvas.setAttribute('tabindex', '0');
    canvas.onclick = function() {
        canvas.focus();
    };
    //自定义屏幕鼠标响应
    var handler = new Cesium.ScreenSpaceEventHandler(canvas);
    var flags = {
        //记录鼠标状态
        leftDown : false,
        middleDown : false,
        rightDown : false,
        annotate : false
    };
    handler.setInputAction(function(movement) {
        flags.leftDown = true;
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
    handler.setInputAction(function(movement) {
        flags.middleDown = true;
    }, Cesium.ScreenSpaceEventType.MIDDLE_DOWN);
    handler.setInputAction(function(movement) {
        flags.rightDown = true;
    }, Cesium.ScreenSpaceEventType.RIGHT_DOWN);
    handler.setInputAction(function(movement) {
        flags.leftDown = false;
    }, Cesium.ScreenSpaceEventType.LEFT_UP);
    handler.setInputAction(function(movement) {
        flags.middleDown = false;
    }, Cesium.ScreenSpaceEventType.MIDDLE_UP);
    handler.setInputAction(function(movement) {
        flags.rightDown = false;
    }, Cesium.ScreenSpaceEventType.RIGHT_UP);
    //按住shift+w可以禁用注释信息
    document.addEventListener('keyup', function(e) {
        if (e.keyCode === 'W'.charCodeAt(0)) {
            flags.annotate = !flags.annotate;
        }
    }, false);

    //是否允许选择tileset建筑
    var pickingEnabled = true;
    //设置鼠标停留处建筑模型高亮
    var current = {
        feature : undefined,
        originalColor : new Cesium.Color()
    };
    var HIGHLIGHT_COLOR = new Cesium.Color(1.0, 1.0, 0.0, 0.4);
    handler.setInputAction(function(movement) {
        if (!pickingEnabled) {
            return;
        }
        if (flags.leftDown || flags.middleDown || flags.rightDown) {
            //漫游中禁用选择
            return;
        }
        //记录被选中元素
        var pickedFeature = scene.pick(movement.endPosition);
        if (Cesium.defined(current.feature) && (current.feature !== pickedFeature)) {
            // Restore original color to feature that is no longer selected
            // This assignment is necessary to work with the set property
            current.feature.color = Cesium.Color.clone(current.originalColor, current.feature.color);
            current.feature = undefined;
        }
        if (Cesium.defined(pickedFeature) && (pickedFeature !== current.feature)) {
            // For testing re-evaluating a style when a property changes
            //      pickedFeature.setProperty('id', 1);
            current.feature = pickedFeature;
            Cesium.Color.clone(pickedFeature.color, current.originalColor);
            // Highlight newly selected feature
            pickedFeature.color = Cesium.Color.clone(HIGHLIGHT_COLOR, pickedFeature.color);
        }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    //左键建筑显示详细信息
    var infobox = new Cesium.Entity('Title to put in the infobox');
    handler.setInputAction(function(movement) {
        if (!pickingEnabled) {
            return;
        }

        var feature = current.feature;
        if (Cesium.defined(feature)) {
            var str = '';
            viewer.entities.remove(infobox);
            var properties = feature.primitive.properties;
            if (Cesium.defined(properties)) {
                for (var name in properties) {
                    if (properties.hasOwnProperty(name)) {
                        console.log(name + ': ' + feature.getProperty(name));
                        str=str+'<tr><th style="width:120px;font-weight:bold;">'+name+'</th><th style="font-weight:normal;">'+feature.getProperty(name)+'</th></tr>'
                    }
                }
            }

            var title = feature.getProperty('name');
            var tid = feature.getProperty('TARGET_FID');
            infobox.name = (title !== ' ')?(title):(tid);
            infobox.description = {
                getValue : function() {
                    return '<table style="text-align:left">'+str+'</table>';
                }
            };
            viewer.entities.add(infobox);
            viewer.selectedEntity = infobox;
            // evaluate feature description
            if (Cesium.defined(tileset.style.meta.description)) {
                console.log("Description : " + tileset.style.meta.description.evaluate(feature));
            }
            feature.setProperty('clicked', true);
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    //鼠标左键双击事件
    var annotations = scene.primitives.add(new Cesium.LabelCollection());
    handler.setInputAction(function(movement) {
        if (!pickingEnabled) {
            return;
        }

        if (flags.annotate) {
            //在鼠标位置显示高度
            annotate(movement);
        } else {
            //显示被双击的建筑物
            zoom(movement);
        }
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    function annotate(movement) {
        if (Cesium.defined(current.feature) && scene.pickPositionSupported) {
            var cartesian = scene.pickPosition(movement.position);
            var cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            var height = cartographic.height.toFixed(2) + ' m';

            annotations.add({
                position : cartesian,
                text : height,
                horizontalOrigin : Cesium.HorizontalOrigin.LEFT,
                verticalOrigin : Cesium.VerticalOrigin.BOTTOM,
                eyeOffset : new Cesium.Cartesian3(0.0, 0.0, -1.0)
            });
        }
    }

    function offsetFromHeadingPitchRange(heading, pitch, range) {
        pitch = Cesium.Math.clamp(pitch, -Cesium.Math.PI_OVER_TWO, Cesium.Math.PI_OVER_TWO);
        heading = Cesium.Math.zeroToTwoPi(heading) - Cesium.Math.PI_OVER_TWO;

        var pitchQuat = Cesium.Quaternion.fromAxisAngle(Cesium.Cartesian3.UNIT_Y, -pitch);
        var headingQuat = Cesium.Quaternion.fromAxisAngle(Cesium.Cartesian3.UNIT_Z, -heading);
        var rotQuat = Cesium.Quaternion.multiply(headingQuat, pitchQuat, headingQuat);
        var rotMatrix = Cesium.Matrix3.fromQuaternion(rotQuat);

        var offset = Cesium.Cartesian3.clone(Cesium.Cartesian3.UNIT_X);
        Cesium.Matrix3.multiplyByVector(rotMatrix, offset, offset);
        Cesium.Cartesian3.negate(offset, offset);
        Cesium.Cartesian3.multiplyByScalar(offset, range, offset);
        return offset;
    }

    function zoom(movement) {
        var feature = current.feature;
        if (Cesium.defined(feature)) {
            var longitude = feature.getProperty('Longitude');
            var latitude = feature.getProperty('Latitude');
            var height = feature.getProperty('Height');

            if (!Cesium.defined(longitude) || !Cesium.defined(latitude) || !Cesium.defined(height)) {
                return;
            }

            var positionCartographic = new Cesium.Cartographic(longitude, latitude, height * 0.5);
            var position = scene.globe.ellipsoid.cartographicToCartesian(positionCartographic);

            var camera = scene.camera;
            var heading = camera.heading;
            var pitch = camera.pitch;

            var offset = offsetFromHeadingPitchRange(heading, pitch, height * 2.0);

            var transform = Cesium.Transforms.eastNorthUpToFixedFrame(position);
            Cesium.Matrix4.multiplyByPoint(transform, offset, position);

            camera.flyTo({
                destination : position,
                orientation : {
                    heading : heading,
                    pitch : pitch
                },
                easingFunction : Cesium.EasingFunction.QUADRATIC_OUT
            });
        }
    }

    //设置高度样式对话框
    var myTextArea = document.getElementById("editor");
    var textJson = {"color" : {
        "conditions" : {
            "${height} >= 200" : "color('#ffe5cc')",
            "${height} >= 150" : "color('#ffffcc')",
            "${height} >= 100" : "color('#e5ffcc')",
            "${height} >= 50" : "color('#ccffcc')",
            "${height} >= 20" : "color('#ccffe5')",
            "${height} >= 10" : "color('#ccffff')",
            "true" : "color('#cce5ff')"
        }
    }};
    var text = JSON.stringify(textJson, null, 2);
    var myCodeMirror = CodeMirror.fromTextArea(myTextArea,{
        autoRefresh:true,
        mode:  "application/json",
        lineNumbers: true,
        autofocus:true
    });
    myCodeMirror.setValue('//当前样式:随高度改变颜色\n'+text);
    //改变tileset颜色
    function saveStyle(){
        var content = myCodeMirror.getValue();
        var index = content.indexOf('{');
        content = content.slice(index);
        console.log(content);
        var color = JSON.parse(content);
        console.log(color);
        tileset.style = new Cesium.Cesium3DTileStyle(color);
    }
    //在toolbar中添加设置颜色按钮
    var btn = document.createElement('button');
    btn.setAttribute('type','button');
    btn.setAttribute('title','Style');
    btn.setAttribute('data-toggle','modal');
    btn.setAttribute('data-target','#myModal');
    btn.setAttribute('class','cesium-button cesium-toolbar-button');
    document.getElementsByClassName('cesium-viewer-toolbar')[0].appendChild(btn);

    //设置tileset按钮框位置
    document.getElementById('spot-menu').setAttribute('style', currentPostion);
    //加载tileset
    function loadTileset(url) {
        var tileset;
        if (Cesium.defined(tileset)) {
            scene.primitives.remove(tileset);
        }
        tileset = scene.primitives.add(new Cesium.Cesium3DTileset({
            url : url,
            debugShowStatistics : true,
            maximumNumberOfLoadedTiles : 3
        }));

        return tileset.readyPromise.then(function(tileset) {
            // var boundingSphere = tileset.boundingSphere;
            // viewer.camera.viewBoundingSphere(boundingSphere, new Cesium.HeadingPitchRange(0, -2.0, 0));
            // viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
            viewer.camera.setView({
                destination : new Cesium.Cartesian3(978703.4032039205, -5664709.285048889, 2754627.305272117),
                orientation : {
                    direction : new Cesium.Cartesian3(0.33506436388093397, 0.7178758873584659, 0.6102344487214404),
                    up : new Cesium.Cartesian3(0.27649053726026684, -0.6940744040291643, 0.6646906833084766)
                }
            });
            var properties = tileset.properties;
            if (Cesium.defined(properties) && Cesium.defined(properties.height)) {
                tileset.style = new Cesium.Cesium3DTileStyle({
                    "color" : {
                        "conditions" : {
                            "${height} >= 200" : "color('#ffe5cc')",
                            "${height} >= 150" : "color('#ffffcc')",
                            "${height} >= 100" : "color('#e5ffcc')",
                            "${height} >= 50" : "color('#ccffcc')",
                            "${height} >= 20" : "color('#ccffe5')",
                            "${height} >= 10" : "color('#ccffff')",
                            "true" : "color('#cce5ff')"
                        }
                    },
                    "meta" : {
                        "description" : "'Building id ${id} has height ${height}.'"
                    }
                });
                //在按钮框中添加按钮
                var spotbtn=document.createElement('button');
                spotbtn.setAttribute('class','spot-button');
                var spotlabel=document.createElement('label');
                spotlabel.innerHTML = 'Miami';
                spotbtn.appendChild(spotlabel);
                document.getElementById('spot-menu').appendChild(spotbtn);
                var target = tileset.boundingSphere.center;
                spotbtn.addEventListener('click', function () {
                    viewer.camera.flyTo({
                        destination : target,
                        orientation : {
                            direction: new Cesium.Cartesian3(0.33506436388093397, 0.7178758873584659, 0.6102344487214404),
                            up: new Cesium.Cartesian3(0.27649053726026684, -0.6940744040291643, 0.6646906833084766)
                        }
                    });
                })
            }
            //加载异常情况处理
            tileset.loadProgress.addEventListener(function(numberOfPendingRequests, numberProcessing) {
                if ((numberOfPendingRequests === 0) && (numberProcessing === 0)) {
                    //console.log('Stopped loading');
                    return;
                }
                //console.log('Loading: requests: ' + numberOfPendingRequests + ', processing: ' + numberProcessing);
            });
            tileset.tileUnload.addEventListener(function(tile) {
                //console.log('Tile unloaded.')
            });
        });
    }
    //根据模型目录列表加载tileset
    var dataurls = ["./data/Miami", "./data/Scene"];
    loadTileset(dataurls[0])
    loadTileset(dataurls[1])
}());