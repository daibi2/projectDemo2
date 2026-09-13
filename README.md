# 泊位管家 · 停车场管理系统

一个基于 Next.js 与 SQLite 的全栈停车场管理系统。每个账户拥有完全隔离的停车场、车辆和停车记录。

## 功能

- 注册、登录和 7 天 HTTP-only JWT 会话
- 创建、编辑、删除自己的停车场；创建时自动生成固定数量的可用车位
- 车辆入场时自动分配空闲车位；满位时返回清晰错误
- 车辆出场时按每小时 ¥8（不足一小时按一小时）自动计费，并释放车位
- 同一账户下，一个车牌只能有一条未完成停车记录
- 服务层和 API 均按所有者校验，不能读取或修改其他账户的资源

## 本地运行

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)，注册账户后即可开始使用。开发数据库默认保存在项目根目录的 `parking.db`。

生产部署请设置一个随机的 `JWT_SECRET`：

```bash
JWT_SECRET="replace-with-a-long-random-secret" npm run start
```

## 验证

```bash
npm test
npm run build
```

测试覆盖所有者数据隔离、满位拒绝和车牌单条在场记录约束。