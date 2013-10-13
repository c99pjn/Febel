var StateModel = function(table) {
    var table = table;
    var features = {};
    var taglist = {};
    var tagListOrder = [];
    var allChange = false;
    var deleteBeforeDraw = false;
    var updateBar;
    var sorting = {"on": "name", "value":0};
    table.addEventListener('dblclick', makeEditable);
    table.addEventListener('keydown', handleKeyEvent);

    var tagDivs = document.getElementById("tag-lists");
    tagDivs.addEventListener('click', handleTagClick.bind(this));
    document.getElementById("h1").addEventListener("click", changeSorting.bind(this));
    document.getElementById("h2").addEventListener("click", changeSorting.bind(this));

    localStorage.tagListOrder = localStorage.tagListOrder || JSON.stringify({});
    var lsTO = JSON.parse(localStorage.tagListOrder);
    tagListOrder = lsTO[project] || tagListOrder;

    this.addUpdateFeature = function(id, name, info, tags, draw) {
        if (features[id]) {
            features[id].update(id, name, info);
        } else { 
            features[id] = new Feature(id, name, info);
        }
        features[id].resetTags();
        tags.forEach(function(t) {
            if (!taglist[t.group]) {
                taglist[t.group] = {};
                allChange = true;
            }
            taglist[t.group][t.id] = taglist[t.id] || new Tag(t.id, t.name, t.group);
            taglist[t.group]["all"] = taglist[t.group]["all"] || {'selected': true};
            features[id].addTag(t.id);
        });
        for (group in taglist) {
            if (Object.keys(taglist[group]).length == 0) {
                delete(taglist[group]);
            }
            if (tagListOrder.indexOf(group) == -1) {
                tagListOrder.push(group);
            }
        }
    };

    this.print = function() {
        console.log(features, taglist);
    };

    this.setTaglistOrder = function(tlo) {
        tagListOrder = tlo;
        allChange = true;
    };

    this.addTag = function(name) {
        allChange = true;
        taglist[name] = taglist[name] || {};
        taglist[name]["all"] = taglist[name]["all"] || {'selected': true};
        if (tagListOrder.indexOf(name) == -1) {
            tagListOrder.push(name);
        }
        this.draw();
    };

    this.verifyOrder = function() {
        for (i in tagListOrder) {
            group = tagListOrder[i];
            if (!taglist[group]) {
                tagListOrder.splice(tagListOrder.indexOf(group),1);
                localStorage.tagListOrder = JSON.stringify(lsTO);
            }
        }
    }

    this.draw = function() {
        if (Object.keys(taglist)==0) {
            taglist["Tags"] = {};
            taglist["Tags"]["all"] = {'selected': true};
            tagListOrder.push("Tags");
        }
        this.verifyOrder();
        if (allChange || document.getElementById("titlebar").childElementCount - 2 != Object.keys(taglist).length) {
            var tbar = document.getElementById("titlebar");
            while(tbar.childElementCount > 2) {
                tbar.removeChild(tbar.lastChild);
            }
            for (i in tagListOrder) {
                var group = tagListOrder[i];
                var th = document.createElement("th");
                th.id = "th"+i;
                var leftArrow = document.createElement("span");
                leftArrow.addEventListener('click', handleLeftArrow.bind(this));
                leftArrow.innerHTML = "&#x25C0;";
                leftArrow.style.left = "5px";
                var rightArrow = document.createElement("span");
                rightArrow.addEventListener('click', handleRightArrow.bind(this));
                rightArrow.innerHTML = "&#x25B6;";
                rightArrow.style.right = "5px";
                rightArrow.style.top = "0px";
                var text = document.createElement("div");
                text.classList.add("textdiv");
                text.innerHTML = group;
                text.addEventListener('blur', handleBlurEvent.bind(this));
                text.id = "taggroup_"+group;
                th.appendChild(leftArrow);
                th.appendChild(text);
                th.appendChild(rightArrow);
                th.classList.add("tag_header");
                tbar.appendChild(th);
            }
        }
        
        var sorted = this.getSortedFeatures();
        console.log(sorted)
        for (i in sorted) {
            sorted[i].draw();
        }

        if (updateBar) updateBar.removeElement();
        updateBar = new Feature("new", "", "");
        updateBar.draw();
        updateBar.el.style.height = "20px";
        createTagList(taglist);
        createResizeDivs();
        allChange = false;
    }

    this.getSortedFeatures = function() {
        var arr = [];
        for (var key in features) {
            arr.push(features[key]);
        }
        if (sorting["value"] != 0) {
            var sorted = arr.sort(function(a, b) {if (a[sorting["on"]].toLowerCase() > b[sorting["on"]].toLowerCase()) {return sorting["value"]} else {return -1*sorting["value"]}});
            return sorted;
        } else {
            return arr;
        }
    }

    this.getFeatures = function() {
        return features;
    }

    this.getTags = function() {
        return taglist;
    }

    function makeEditable(e) {
        var target = e.target;
        while(target.tagName != "TD" && target.tagName != "TH") {
            target = target.parentNode;
        }
        if (target.tagName == "TD" || target.tagName == "TH") {
            var div = target.getElementsByClassName("textdiv")[0];
            var tags = div.getElementsByClassName("tag");
            if (tags.length == 0) {
                div.contentEditable = true;
                div.focus();
            } else {
                if (e.target.classList.contains("tag")) {
                    e.target.contentEditable = true;
                    e.target.focus();
                } else {
                    tags[tags.length-1].contentEditable = true;
                    tags[tags.length-1].innerHTML = "";
                    tags[tags.length-1].focus();
                }
            }
        } else {
            target.contentEditable = true;
            target.focus();
        }
    }

    function handleBlurEvent(e) {
        var id = e.target.id.split("_");
        var mess = {};
        mess["feature_id"] = "taggroup";
        mess["old"] = id[1];
        mess["project"] = project;
        mess["new"] = e.target.innerHTML;
        ws.send(JSON.stringify([mess]));
    }

    function changeSorting(e) {
        var ele = e.target;
        var on = "info";
        if (ele.id == "h1") {
            on = "name";
        } 

        if (sorting["on"] != on || sorting["value"] == 0) {
            sorting["value"] = 1;
            sorting["on"] = on;
        } else if (sorting["value"] == 1){
            sorting["value"] = -1;
        } else {
            sorting["value"] = 0;
        }
        deleteBeforeDraw = true;
        this.draw();
        deleteBeforeDraw = false;
    }

    function handleKeyEvent(e) {
        if (e.keyCode == 13 && !e.shiftKey) {
            document.activeElement.blur();
        }
    }
 
    function handleTagClick(e) {
        var clicked = e.target.id;
        if (clicked.indexOf("all") > -1) {
            var group = clicked.split(/_/)[2];
            var isSelected = taglist[group]["all"].selected;
            for (tag in taglist[group]) {
                if (isSelected) {
                    taglist[group][tag].selected = false;
                } else {
                    taglist[group][tag].selected = true;
                }
            }
        } else {
            for (group in taglist) {
                if (taglist[group][clicked]) {
                    taglist[group][clicked].selected = !taglist[group][clicked].selected;
                }
                var sum = true;
                for(tag in taglist[group]) {
                    if (tag != "all") sum = sum&&taglist[group][tag].selected;
                }
                taglist[group]["all"].selected = sum;
            }
        }
        this.draw();
    }

    function handleLeftArrow(e) {
        var group = e.target.parentNode.childNodes[1].innerHTML;
        var index = tagListOrder.indexOf(group);
        if (index > 0) {
            var tmp = tagListOrder[index-1];
            tagListOrder[index-1] = tagListOrder[index];
            tagListOrder[index] = tmp;
            lsTO[project] = tagListOrder;
            localStorage.tagListOrder = JSON.stringify(lsTO);
        }
        allChange = true;
        this.draw();
    }

    function handleRightArrow(e) {
        var group = e.target.parentNode.childNodes[1].innerHTML;
        var index = tagListOrder.indexOf(group);
        if (index < tagListOrder.length-1 ) {
            var tmp = tagListOrder[index+1];
            tagListOrder[index+1] = tagListOrder[index];
            tagListOrder[index] = tmp;
            lsTO[project] = tagListOrder;
            localStorage.tagListOrder = JSON.stringify(lsTO);
            allChange = true;
            this.draw();
        }
    }

    var Feature = function(id, name, info) {
        this.id = id;
        this.name = name;
        this.info = info;
        this.tags = [];
        this.changed = true;
        this.el = null;

        this.addTag = function(id) {
            this.tags.push(id);
        }

        this.resetTags = function() {
            this.tags = [];
            this.changed = true;
        }

        this.removeElement = function() {
            if (this.el) this.el.parentNode.removeChild(this.el);
            this.changed = true;
        }

        this.update = function(id, name, info) {
            this.id = id;
            this.name = name;
            this.info = info;
            if (this.name) {
                this.changed = true;
            } else if(this.el){
                this.removeElement();
            }
        }

        this.draw = function() {
            if (this.changed || allChange) {
                this.changed = false;
                if (!this.el) {
                    this.el = document.createElement("tr");
                    table.appendChild(this.el);                
                }
                while(this.el.childElementCount > 0) {
                    this.el.removeChild(this.el.lastChild);
                }

                this.el.appendChild(createTD(this.name, this.handleFocusEvent.bind(this, "name", ""), this.handleBlurEvent.bind(this, "name", ""), this.handleAnimationEnd.bind(this)));
                this.el.appendChild(createTD(this.info, this.handleFocusEvent.bind(this, "info", ""), this.handleBlurEvent.bind(this, "info", "")));

                for (i in tagListOrder) {
                    var group = tagListOrder[i];
                    var td = document.createElement("td");
                    var div = document.createElement("div");
                    div.classList.add("textdiv");
                    var sorted = this.tags.sort(function(a, b) {if (taglist[group][a] && taglist[group][b] && taglist[group][a].name>taglist[group][b].name) {return 1} else {return -1}});
                    for (var i = 0; i < sorted.length; i++) {
                        if (taglist[group][sorted[i]]) {
                            div.appendChild(createTagLinks(taglist[group][sorted[i]].name, this.handleFocusEvent.bind(this, sorted[i], group), this.handleBlurEvent.bind(this, sorted[i], group)));  
                            div.appendChild(document.createElement("br"));                          
                        }
                    };

                    div.appendChild(createTagLinks("", this.handleFocusEvent.bind(this, "", group), this.handleBlurEvent.bind(this, "", group)));
                    td.appendChild(div);
                    this.el.appendChild(td);
                }
            }
            var visible = [];
            for (i in tagListOrder) {
                var group = tagListOrder[i];
                var ind = visible.push(false)
                var count = 0;
                this.tags.forEach(function(t) {
                    if (taglist[group][t]) {
                        if (taglist[group][t].selected == true) {
                            visible[ind-1] = true;
                        }
                        count++;
                    }
                });
                if (!count) {
                    if (taglist[group]["all"].selected) {
                        visible[ind-1] = true;    
                    } else {
                        visible[ind-1] = localStorage["settingNoTags"] == "true" ? true : false;
                    }
                }

            }
            if (visible.length < 1 || visible.reduce(function(a,b) { if (localStorage["settingAllGroups"] == "true") {return a&&b} else {return a||b}})) {
                this.show();
            } else {
                this.hide();
            }
        }

        var shownDone = true;
        this.hide = function() {
            if (shownDone) {
                var divs = this.el.getElementsByClassName("textdiv");
                if (this.el.style.display != "none") {
                    for(var i=0; i<divs.length; i++) {
                        divs[i].style.height = divs[i].offsetHeight;
                    }
                    for(var i=0; i<divs.length; i++) {
                        divs[i].oldHeight = divs[i].offsetHeight;
                        divs[i].classList.add("animate");
                    }
                    for(var i=0; i<divs.length; i++) {
                        divs[i].style.height = "0px";
                    }
                }
            }
        }
        this.show = function() {
            this.el.style.display = "";
            var that = this;
            shownDone = false;
            window.setTimeout(function(){
                var divs = that.el.getElementsByClassName("textdiv");
                for(var i=0; i<divs.length; i++) {
                    if (divs[i].style.height == "0px") {
                        divs[i].style.height = divs[i].oldHeight;
                    }
                }
            },100);
            window.setTimeout(function() {
                shownDone = true;
            }, 600);    
        }

        this.handleFocusEvent = function(id, group, e) {
            var ta = e.target;
            ta.innerHTML = escapeHTML(ta.innerHTML);
            ta.contentBefore = ta.innerHTML;
            //clearSelection();
        }

        this.handleBlurEvent = function(id, group, e) {
            var ta = e.target;
            ta.contentEditable = false;
            var text = ta.innerHTML;
            if (text != ta.contentBefore) {    
                var mess = {};
                mess["feature_id"] = this.id;
                mess["project"] = project;
                if (id == "name") {
                    mess["feature_name"] = text;
                } else if (id == "info") {
                    mess["info"] = unescapeHTML(text);
                } else {
                    mess["tags"] = [{'id':id, 'name': text, 'group': group}];
                }
                //console.log(JSON.stringify([mess]));
                ws.send(JSON.stringify([mess]));
            } else {
                ta.innerHTML = unescapeHTML(ta.innerHTML);
            }
        }

        this.handleAnimationEnd = function(e) {
            var div = e.target;
            if (div.style.height != "0px") {
                div.classList.remove("animate");
                div.style.height = "";    
            } else {
                div.parentNode.parentNode.style.display = "none";
            }
        }
    };

    var Tag = function(id, name, group) {
        this.id = id;
        this.name = name;
        this.group = group;
        this.selected = true;
        this.features = [];
    };
};

function createTD(text, focusFn, blurFn, animEndFn) {
    var td = document.createElement("td");
    var div = document.createElement("div");
    div.classList.add("textdiv");
    div.innerHTML = text;
    div.addEventListener('focus', focusFn);
    div.addEventListener('blur', blurFn);
    div.addEventListener( 'webkitTransitionEnd', animEndFn);
    div.addEventListener( 'transitionend', animEndFn);
    td.appendChild(div);
    return td;
}

function createTagLinks(text, focusFn, blurFn) {
    var link = document.createElement("div");
    link.innerHTML = text;
    link.classList.add("tag");
    link.addEventListener('focus', focusFn);
    link.addEventListener('blur', blurFn);
    return link;
}

function createTagList(tagList) {
    var tagDivs = document.getElementById("tag-lists");
    //console.log(tagList)
    while(tagDivs.childElementCount > 0) {
        tagDivs.removeChild(tagDivs.lastChild);
    }
    
    var tagTemplate = document.createElement("div");
    tagTemplate.classList.add("link");
    for (group in tagList) {
        var tagDiv = document.createElement("div");
        tagDiv.style.paddingBottom = "10px";
        var title = document.createElement("span");
        title.innerHTML = group;
        tagDiv.appendChild(title);
        
        var allTag = tagTemplate.cloneNode(false);
        allTag.innerHTML = "All";
        allTag.id = "taglist_all_"+group;
        if (!tagList[group]["all"].selected) {
            allTag.classList.add("unselected");
        }
        tagDiv.appendChild(allTag);

        var sortedKeys = Object.keys(tagList[group]).sort(function(a, b) {if (tagList[group][a].name>tagList[group][b].name) {return 1} else {return -1}});
        sortedKeys.forEach(function(s) {
            if (s != "all") {
                var item = tagTemplate.cloneNode(false);
                item.innerHTML = tagList[group][s].name;
                item.id = s;
                if (!tagList[group][s].selected) {
                    item.classList.add("unselected");
                }
                tagDiv.appendChild(item);
            }
        });
        tagDivs.appendChild(tagDiv);
    }
}

function unescapeHTML(str) {
    return str.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
}

function escapeHTML(str) {
    return str.replace(/<br>/g,"_br_").replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/_br_/g, "<br>");
}

var dragging;
document.addEventListener('mouseup', handleDragStop);

function createResizeDivs() {
    var rw = document.getElementById("resizewrapper");
    while(rw.childElementCount > 0) {
        rw.removeChild(rw.lastChild);
    }

    var tb = document.getElementById("titlebar");
    var ths = tb.getElementsByTagName("th");
    for (var i = 0; i < ths.length-1; i++) {
        var pos = ths[i].getBoundingClientRect();
        var div = document.createElement("div");
        div.classList.add("drag_div");
        div.style.left = pos.right - 5 + "px";
        div.style.top = pos.top+"px";
        div.style.height = pos.height+"px"
        div.hid = ths[i].id;
        div.addEventListener('mousedown', handleDragStart);
        rw.appendChild(div);
    };
}

function handleDragStart(e) {
    document.addEventListener('mousemove', handleDrag);
    e.target.startY = e.x;
    e.target.startLeft = e.target.getBoundingClientRect().left;
    dragging = e.target;
}

function handleDrag(e) {
    dragging.style.left = (dragging.startLeft+(e.x-dragging.startY)) + "px";
    var th = document.getElementById(dragging.hid);
    var pos = th.getBoundingClientRect();
    th.style.width = (dragging.startLeft+(e.x-dragging.startY)+5 - pos.left) + "px"
}

function handleDragStop(e) {
    //console.log(e);
    if (dragging) {
        createResizeDivs();
    }
    document.removeEventListener('mousemove', handleDrag);
}

function handleInputChange(e) {
    localStorage[e.target.id] = e.target.checked;
}

function showHideSettingsPane() {
    var pane = document.getElementById("pane");
    if (pane.style.display == "block") {
        pane.style.display = "none";
    } else {
        pane.style.display = "block";
    }
}