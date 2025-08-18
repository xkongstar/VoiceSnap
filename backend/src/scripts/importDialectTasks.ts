import mongoose from "mongoose"
import { Task } from "../models/Task"
import dotenv from "dotenv"
import fs from "fs"
import path from "path"

dotenv.config()

// 新化方言录音任务数据
const dialectTasks = [
  // 第一部分：日常问候与寒暄
  { text_id: "XINHUA_001", text_content: "你好！最近怎么样？" },
  { text_id: "XINHUA_002", text_content: "早上好/上午好/下午好/晚上好。" },
  { text_id: "XINHUA_003", text_content: "你吃饭了没有？" },
  { text_id: "XINHUA_004", text_content: "吃了，你呢？" },
  { text_id: "XINHUA_005", text_content: "好久不见，最近在忙什么？" },
  { text_id: "XINHUA_006", text_content: "再见，有空再联系。" },
  { text_id: "XINHUA_007", text_content: "慢走，路上小心。" },
  { text_id: "XINHUA_008", text_content: "谢谢你！/多谢！" },
  { text_id: "XINHUA_009", text_content: "不客气。/不用谢。" },
  { text_id: "XINHUA_010", text_content: "对不起，我不是故意的。" },
  { text_id: "XINHUA_011", text_content: "没关系，小事一桩。" },
  { text_id: "XINHUA_012", text_content: "请问，这个怎么称呼？" },
  { text_id: "XINHUA_013", text_content: "我叫[名字]，很高兴认识你。" },
  { text_id: "XINHUA_014", text_content: "你是哪里人？" },
  { text_id: "XINHUA_015", text_content: "我是新化人。" },

  // 第二部分：家庭与个人信息
  { text_id: "XINHUA_016", text_content: "你家里有几口人？" },
  { text_id: "XINHUA_017", text_content: "你结婚了没有？有小孩吗？" },
  { text_id: "XINHUA_018", text_content: "你儿子/女儿多大了？上几年级了？" },
  { text_id: "XINHUA_019", text_content: "你父母身体还好吗？" },
  { text_id: "XINHUA_020", text_content: "你是做什么工作的？" },
  { text_id: "XINHUA_021", text_content: "我在外面打工。/我在家种田。" },
  { text_id: "XINHUA_022", text_content: "你今年多大年纪了？" },
  { text_id: "XINHUA_023", text_content: "你的电话号码是多少？" },
  { text_id: "XINHUA_024", text_content: "你住在哪个村/哪个社区？" },
  { text_id: "XINHUA_025", text_content: "从你家到县城要多久？" },

  // 第三部分：时间与天气
  { text_id: "XINHUA_026", text_content: "今天是几月几号，星期几？" },
  { text_id: "XINHUA_027", text_content: "现在几点了？" },
  { text_id: "XINHUA_028", text_content: "我的手表好像不准了。" },
  { text_id: "XINHUA_029", text_content: "今天天气真好啊，出大太阳了。" },
  { text_id: "XINHUA_030", text_content: "明天会下雨吗？天气预报怎么说？" },
  { text_id: "XINHUA_031", text_content: "这几天好冷，你要多穿点衣服。" },
  { text_id: "XINHUA_032", text_content: "外面起风了，快把窗户关上。" },
  { text_id: "XINHUA_033", text_content: "今年夏天特别热，热得受不了。" },
  { text_id: "XINHUA_034", text_content: "看样子马上要下暴雨了。" },
  { text_id: "XINHUA_035", text_content: "这种鬼天气，哪里都不想去。" },

  // 第四部分：饮食与购物
  { text_id: "XINHUA_036", text_content: "肚子饿了，我们去哪里吃点东西？" },
  { text_id: "XINHUA_037", text_content: "你想吃米饭还是吃面条？" },
  { text_id: "XINHUA_038", text_content: "老板，来两碗米粉，多放点辣椒。" },
  { text_id: "XINHUA_039", text_content: "这个菜太咸了/太淡了/太辣了。" },
  { text_id: "XINHUA_040", text_content: "结账，一共多少钱？" },
  { text_id: "XINHUA_041", text_content: "老板，这个东西怎么卖？" },
  { text_id: "XINHUA_042", text_content: "能不能便宜一点？" },
  { text_id: "XINHUA_043", text_content: "太贵了，我再到别家看看。" },
  { text_id: "XINHUA_044", text_content: "我想买一件衣服，有没有合适的？" },
  { text_id: "XINHUA_045", text_content: "你帮我称一下这个，看看有多重。" },
  { text_id: "XINHUA_046", text_content: "给我拿那个最好的。" },
  { text_id: "XINHUA_047", text_content: "你家的新化水酒正宗吗？" },
  { text_id: "XINHUA_048", text_content: "去街上买点菜，晚上有客人来。" },

  // 第五部分：交通与问路
  { text_id: "XINHUA_049", text_content: "请问，去汽车站怎么走？" },
  { text_id: "XINHUA_050", text_content: "到这里要坐几路公交车？" },
  { text_id: "XINHUA_051", text_content: "师傅，麻烦您送我到人民医院。" },
  { text_id: "XINHUA_052", text_content: "从这里过去大概要多长时间？" },
  { text_id: "XINHUA_053", text_content: "走路去远不远？" },
  { text_id: "XINHUA_054", text_content: "你在下一个路口把我放下来就行了。" },
  { text_id: "XINHUA_055", text_content: "这里可以停车吗？" },
  { text_id: "XINHUA_056", text_content: "我好像迷路了，找不到方向了。" },
  { text_id: "XINHUA_057", text_content: "去紫鹊界梯田是不是走这条路？" },
  { text_id: "XINHUA_058", text_content: "去梅山龙宫的票在哪里买？" },

  // 第六部分：工作与学习
  { text_id: "XINHUA_059", text_content: "你今天上班累不累？" },
  { text_id: "XINHUA_060", text_content: "这个任务必须在今天之内完成。" },
  { text_id: "XINHUA_061", text_content: "老板又安排了一大堆活。" },
  { text_id: "XINHUA_062", text_content: "我这个月工资还没发。" },
  { text_id: "XINHUA_063", text_content: "我们什么时候开会？" },
  { text_id: "XINHUA_064", text_content: "你家小孩学习成绩怎么样？" },
  { text_id: "XINHUA_065", text_content: "作业做完了没有？" },
  { text_id: "XINHUA_066", text_content: "快要考试了，要抓紧时间复习。" },
  { text_id: "XINHUA_067", text_content: "不要总是玩手机，对眼睛不好。" },
  { text_id: "XINHUA_068", text_content: "他考上了一个好大学。" },

  // 第七部分：健康与情感
  { text_id: "XINHUA_069", text_content: "我感觉有点不舒服，好像感冒了。" },
  { text_id: "XINHUA_070", text_content: "我头痛，喉咙也痛。" },
  { text_id: "XINHUA_071", text_content: "你要不要去医院看一下医生？" },
  { text_id: "XINHUA_072", text_content: "医生说要多喝水，注意休息。" },
  { text_id: "XINHUA_073", text_content: "你今天看起来气色不太好。" },
  { text_id: "XINHUA_074", text_content: "发生什么事了？你怎么哭了？" },
  { text_id: "XINHUA_075", text_content: "我今天特别开心！" },
  { text_id: "XINHUA_076", text_content: "别烦我，我现在心情不好。" },
  { text_id: "XINHUA_077", text_content: "你别担心，事情总会解决的。" },
  { text_id: "XINHUA_078", text_content: "他这个人脾气很古怪。" },

  // 第八部分：描述与评论
  { text_id: "XINHUA_079", text_content: "那个人长得高高瘦瘦的。" },
  { text_id: "XINHUA_080", text_content: "这件衣服的颜色很好看。" },
  { text_id: "XINHUA_081", text_content: "这个房子又大又亮堂。" },
  { text_id: "XINHUA_082", text_content: "他做事非常靠谱。" },
  { text_id: "XINHUA_083", text_content: "我觉得这个办法行不通。" },
  { text_id: "XINHUA_084", text_content: "你这么做是不对的。" },
  { text_id: "XINHUA_085", text_content: "别听他胡说八道。" },
  { text_id: "XINHUA_086", text_content: "这部电影一点意思都没有。" },
  { text_id: "XINHUA_087", text_content: "他唱歌唱得真好听。" },
  { text_id: "XINHUA_088", text_content: "新化这几年的变化真大啊。" },

  // 第九部分：复杂句式与口语
  { text_id: "XINHUA_089", text_content: "如果明天不下雨，我们就去爬山。" },
  { text_id: "XINHUA_090", text_content: "因为堵车，所以我迟到了。" },
  { text_id: "XINHUA_091", text_content: "虽然他嘴上不说，但他心里都明白。" },
  { text_id: "XINHUA_092", text_content: "你不仅自己不做，还不让别人做。" },
  { text_id: "XINHUA_093", text_content: "与其在这里等着，不如我们主动去找他。" },
  { text_id: "XINHUA_094", text_content: "难道你连这点小事都做不好吗？" },
  { text_id: "XINHUA_095", text_content: "这不就是昨天那个谁吗？" },
  { text_id: "XINHUA_096", text_content: "你到底去还是不去，给个准话！" },
  { text_id: "XINHUA_097", text_content: "他那个人啊，就是说起来一套做起来一套。" },
  { text_id: "XINHUA_098", text_content: "管他呢，反正事情已经这样了。" },
]

async function importDialectTasks() {
  try {
    console.log("开始连接数据库...")
    
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI!)
    console.log("✅ 已连接到MongoDB")

    // 检查是否已存在新化方言任务
    const existingTasks = await Task.find({ text_id: { $regex: /^XINHUA_/ } })
    if (existingTasks.length > 0) {
      console.log(`⚠️  发现 ${existingTasks.length} 个已存在的新化方言任务`)
      console.log("是否要删除现有任务并重新导入？")
      
      // 删除现有的新化方言任务
      await Task.deleteMany({ text_id: { $regex: /^XINHUA_/ } })
      console.log("🗑️  已删除现有的新化方言任务")
    }

    // 插入新的方言任务
    console.log(`开始导入 ${dialectTasks.length} 个新化方言录音任务...`)
    
    const insertedTasks = await Task.insertMany(dialectTasks.map(task => ({
      ...task,
      is_active: true,
      created_at: new Date()
    })))

    console.log(`✅ 成功导入 ${insertedTasks.length} 个新化方言录音任务`)
    
    // 显示导入的任务统计
    console.log("\n📊 导入统计:")
    console.log(`总任务数: ${insertedTasks.length}`)
    console.log(`任务ID范围: XINHUA_001 ~ XINHUA_${String(insertedTasks.length).padStart(3, '0')}`)
    
    // 验证导入结果
    const totalTasks = await Task.countDocuments({ text_id: { $regex: /^XINHUA_/ } })
    console.log(`数据库中新化方言任务总数: ${totalTasks}`)

  } catch (error) {
    console.error("❌ 导入新化方言任务时发生错误:", error)
    process.exit(1)
  } finally {
    await mongoose.connection.close()
    console.log("🔌 数据库连接已关闭")
  }
}

// 运行导入脚本
if (require.main === module) {
  console.log("🎙️  新化方言录音任务导入脚本")
  importDialectTasks()
    .then(() => {
      console.log("🎉 导入完成！")
      process.exit(0)
    })
    .catch((error) => {
      console.error("💥 导入失败:", error)
      process.exit(1)
    })
}

export { importDialectTasks, dialectTasks }
