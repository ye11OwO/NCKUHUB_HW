var express = require('express');
var router = express.Router();
var redis = require('../helper/cache').redis;
var db = require('../model/db');
var sanitizeHtml = require('sanitize-html');
var axios = require('axios')
var bot = require('./bot');
var cache = require('../helper/cache');
var courseCacheKey = cache.courseCacheKey;
var middleware = require('../middleware');
var config = require('../config.json');

/* index  */
router.get('/', function (req, res) {
    // Log
    console.log("\n")
    console.log("========================================");
    var dt = new Date();
    console.log(dt);
    console.log("query: " + req.url);
    if (req.user !== undefined) console.log("使用者：" + req.user.name);

    /* 設定 Order 欄位 */
    if (req.query.order) {
        var order = req.query.order;
    } else {
        var order = 'course_name';
    }
    /*  設定要的欄位 */
    var colmuns = ['id', 'course_name', 'catalog', 'teacher', 'semester', 'user_id'];
    db.GetColumn('post', colmuns, {
        'column': order,
        'order': 'DESC'
    }, function (posts) {
        if (req.query.hasOwnProperty("queryw")) {
            db.query_post(posts, req.query.queryw, "query", function (posts, teachers, course_name) {
                if (req.query.order) {
                    res.json(posts);
                } else {
                    res.json({
                        'posts': posts,
                        'teachers': teachers,
                        'course_name': course_name,
                        'user': req.user
                    });
                }
            });
        } else if (req.query.hasOwnProperty("teacher")) {
            db.query_post(posts, req.query.teacher, "teacher", function (posts, teachers, course_name) {
                if (req.query.order) {
                    res.json(posts);
                } else {
                    res.json({
                        'posts': posts,
                        'teachers': teachers,
                        'course_name': course_name,
                        'user': req.user
                    });
                }
            });
        } else if (req.query.hasOwnProperty("course_name")) {
            db.query_post(posts, req.query.course_name, "course_name", function (posts, teachers, course_name) {
                if (req.query.order) {
                    res.json(posts);
                } else {
                    res.json({
                        'posts': posts,
                        'teachers': teachers,
                        'course_name': course_name,
                        'user': req.user
                    });
                }
            });
        } else if (req.query.hasOwnProperty("catalog")) {
            switch (req.query.catalog) {
                case "A9":
                    req.query.catalog = "通識";
                    break;
                case "A2":
                    req.query.catalog = "體育";
                    break;
                case "A1":
                    req.query.catalog = "外國語言";
                    break;
                case "A6":
                    req.query.catalog = "服務學習";
                    break;
                case "A7":
                    req.query.catalog = "基礎國文";
                    break;
                case "AG":
                    req.query.catalog = "公民歷史";
                    break;
                case "M":
                    req.query.catalog = "必修";
                    break;
                case "C":
                    req.query.catalog = "選修";
                    break;
                default:
                    req.query.catalog = "";
                    break;
            }
            db.query_post(posts, req.query.catalog, "catalog", function (posts, teachers, course_name) {
                if (req.query.order) {
                    res.json(posts);
                } else {
                    res.json({
                        'posts': posts,
                        'teachers': teachers,
                        'course_name': course_name,
                        'user': req.user
                    });
                }
            });
        } else {
            var teacher = db.search_item(posts, "teacher");
            var courseName = db.search_item(posts, "course_name");
            if (req.query.order) {
                res.json(posts);
            } else {
                res.json({
                    'posts': posts,
                    'teachers': teacher,
                    'course_name': courseName,
                    'user': req.user
                });
            }
        }
    });
});

/* create */
router.post('/create', function (req, res) {
    var userid = config.userId; // 要登入才可以填寫心得，這邊假設存在一個假的 user (表示有登入才可以繼續往下，否則會被擋)
    req.checkBody('course_name', '課程名稱不可為空').notEmpty();
    req.checkBody('comment', '心得不可為空').notEmpty();
    req.checkBody('comment', '心得最低需求 50 字').isLength({ min: 50 });
    req.checkBody('got', '收穫不可為空').notEmpty();
    req.checkBody('sweet', '甜度不可為空').notEmpty();
    req.checkBody('cold', '涼度不可為空').notEmpty();
    var errors = req.validationErrors();
    if (errors) {
        console.log("Error " + errors);
        res.send(errors);
    } else {
        var post_Data={
            course_name : req.body.course_name,
            teacher : req.body.teacher,
            semester : req.body.semester,
            catalog : req.body.catalog,
            comment : req.body.comment,
            user_id : userid
        }
        db.Insert('post',post_Data,function(){
            var sql = `SELECT id FROM post WHERE course_name LIKE '%` + req.body.course_name + `%' AND comment LIKE '%` + req.body.comment + `%' AND user_id LIKE '%` + userid + `%'`;
            db.Query(sql, function(id){
                var course_rate_Data={
                    sweet : req.body.sweet,
                    cold : req.body.cold,
                    got : req.body.got,
                    course_name : req.body.course_name,
                    teacher : req.body.teacher,
                    user_id : userid,
                    post_id : id[0].id
                }
                db.Insert('course_rate',course_rate_Data,function(){});
            });
        });
        
        
        /**
         * [ BackendHw ]
         *  0. 要過以上 2 個檢驗，一個是目前是 user 登入狀態而不是訪客，另一個是填寫心得部分不可以為空，這邊先幫大家寫好囉～
         *      - 基本上檢查 "填寫心得是否為空值" 應該要在前端寫，送到後端不是個有效率的方法，這部分我們還需要改進ＱＱ
         *  1. 請依照以下格式填入相對應的 2 個 table
         *  2. 前端發到後端的叫做 request，後端回給前端的叫做 response，這隻 API 是要去接收前端來的心得
         *      - Hint: 可以去觀察 req.body，裡頭會告訴你前端塞了什麼東西給咱們後端～
         */

        // post
        // Data: {
        //     course_name : 音樂舞蹈戲劇
        //     teacher : 林怡薇
        //     semester : 107-1
        //     catalog : A9
        //     comment : 這堂課太開心了這堂課太開心了這堂課太開心了這堂課太開心了這堂課太開心了這堂課太開心了這堂課太開心了
        //     user_id : 3
        // }


        // course_rate
        // Data: {
        //     sweet : 6
        //     cold : 6
        //     got : 6
        //     course_name : 音樂舞蹈戲劇
        //     teacher : 林怡薇
        //     user_id : 3
        //     post_id : 3172
        // }

    }
});

/* new */
router.get('/new', function (req, res) {
    var sql = 'SELECT id,課程名稱,時間,老師,系所e名稱,semester FROM course_all WHERE semester ="104-2" OR semester ="105-1" OR semester ="105-2" OR semester ="106-1" OR semester = "106-2"';
    db.Query(sql, function (course) {
        res.json({
            'course': course,
            'user': req.user
        });
    });
});

/* show */
router.get('/:id', function (req, res) {
    var id = req.params.id;
    if (id.match(/\D/g)) {
        console.log('\n' + 'GET /post/' + id);
        res.redirect('/');
    } else {
        console.log('\n' + 'GET /post/' + id);
        db.FindbyID('post', id, function (post) {
            db.FindbyColumn('course_rate', ['give', 'got'], {
                "post_id": post.id
            }, function (rate) {
                res.json({
                    'post': post,
                    'user': req.user,
                    'rate': (rate.length > 0) ? rate[0] : null
                });
            });
        });
    }
});



/*report post */
router.post('/report/:id', function (req, res) {
    /* 要檢舉的文章id*/
    var postid = parseInt(req.params.id);
    console.log('\n' + 'POST /post/report/' + postid);
    /* 檢查用戶是否登入 */
    var userid = req.body['user'];
    if (userid !== undefined) {
        /* 檢查是否檢舉過 依照user_id及post_id去尋找 */
        db.FindbyColumn('report_post', ["id"], {
            'post_id': postid,
            'user_id': userid
        }, function (reports) {
            if (reports.length > 0) {
                console.log('Already report');
                res.send('Already report');
            } else {
                /* 區分檢舉原因 */
                var type = req.body['reason'];
                var reason = type;
                /* 新增檢舉紀錄 */
                var report_post = {
                    user_id: userid,
                    post_id: postid,
                    reason: reason
                }
                db.Insert('report_post', report_post, function (err, results) {
                    if (err) throw err;
                    console.log('Report post ' + postid + ' success');
                    /* 依照post_id將文章的檢舉次數+1 */
                    db.UpdatePlusone('post', 'report_count', postid, function (results) {
                        res.send('Success');
                    });
                });
                // bot.sendReport(report_post);
            }
        });
    } else {
        console.log('No login');
        res.send('No Login');
    }
});

/*report post */
router.post('/setWish/:userID', function (req, res) {
    console.log(req.body['now_whishlist']);
    var userID = 1564;
    var TEMP = "DELETE FROM wishList WHERE userID=" + userID;
    // console.log(TEMP);
    console.log(req.body);

    db.Query(TEMP, function () {
        for (var i in req.body['now_wishlist']) {
            var sql_in = "insert into wishList(userID, courseID) value (" + userID + "," + req.body['now_wishlist'][i] + ")";
            db.Query(sql_in, function () { });
        }
    })
    
    // var data = {
    //     userID: 1564,
    //     courseID: req.body['now_wishlist'][i],
    // };
    // db.Insert('wishList', data, function () { });


    // db.Query(delete from wishlist where userID=1564, function () {})
    // for(var i in req.body['now_wishlist']){

    //     // db.Query(insert into wishList(userID, courseID) Values(userID req.body['now_wishlist'][i]`)`, function () { })
    // }

    // console.log(req.body)
    // console.log(req.body['now_wishlist'])
    // for (var i in req.body['now_wishlist']) {
    //     console.log(i);
    //     console.log(req.body['now_wishlist'][i])

    // }
    /**
     * [ BackendHw ]
     *  0. 此 API 是用來記錄下 user 的願望課程，因為需要紀錄是哪個 user 的，所以先幫各位假定了一個
     *  1. 依照下面的格式放入 wishList 這個資料表
     *  2. 前端發到後端的叫做 request，後端回給前端的叫做 response
     *      - Hint: 可以去觀察 req.body，裡頭會告訴你前端塞了什麼東西給咱們後端～
     *  3. 要去考慮到刪除願望清單的情況，在這邊把 "刪除" 和 "新增" 都寫在這個 API 了
     *      - Hint: 新增之前要先把資料庫原有的願望清單刪除～
     */

    // wishList
    // Data: {
    //     userID : 1171
    //     courseID : 42693
    // }
});


router.post('/setTable/:userID', function (req, res) {
    var userID = 1564;
    console.log(req.body);
    var temp_table = "delete from tableList where userID=" + userID;
    db.Query(temp_table, function () {
        for (var i in req.body['now_table']) {
            var data = {
                userID: 1564,
                courseID: req.body['now_table'][i],
                userName: "汪曉東C",
            };
            db.Insert('tableList', data, function () { });
        }
    });
    /**
     * [ BackendHw ]
     *  0. 此 API 是用來記錄下 user 的自己排的課表，因為需要紀錄是哪個 user 的，所以先幫各位假定了一個
     *  1. 依照下面的格式放入 tableList 這個資料表
     *  2. 前端發到後端的叫做 request，後端回給前端的叫做 response
     *      - Hint: 可以去觀察 req.body，裡頭會告訴你前端塞了什麼東西給咱們後端～
     *  3. 要去考慮到刪除願望清單的情況，在這邊把 "刪除" 和 "新增" 都寫在這個 API 了
     *      - Hint: 新增之前要先把資料庫原有的願望清單刪除～
     */

    // tableList
    // Data: {
    //     userID : config.userId
    //     courseID : 42693
    //     userName : 汪曉章
    // }
});


/* del */
router.delete('/:id', function (req, res) {
    var id = req.params.id;
    console.log('\n' + 'DELETE post/' + id);
    db.DeleteById('post', id, function (err) {
        res.send('Success');
    });
});

module.exports = router;