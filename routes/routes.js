const { ObjectId } = require("mongodb");

module.exports = (app, {
  employees,
  attendance,
  advances,
  customers,
  sellingRate
}) => {

  /* ================= EMPLOYEES ================= */

  app.post("/employees", async (req, res) => {
    const { name, dailySalary } = req.body;
    if (!name || !dailySalary) {
      return res.status(400).send({ message: "Name & salary required" });
    }

    const result = await employees.insertOne({
      name,
      dailySalary: Number(dailySalary),
      createdAt: new Date(),
      status: "active",
    });

    res.send(result);
  });

  app.get("/employees", async (req, res) => {
    const result = await employees.find().sort({ createdAt: -1 }).toArray();
    res.send(result);
  });

// employee update
app.patch("/employees/:id", async (req, res) => {
  const { id } = req.params;
  const { name, dailySalary, status } = req.body;

  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ message: "Invalid employee id" });
  }

  const update = {};

  if (name) update.name = name;
  if (dailySalary !== undefined) update.dailySalary = Number(dailySalary);
  if (status) update.status = status; // active / inactive

  const result = await employees.updateOne(
    { _id: new ObjectId(id) },
    { $set: update }
  );

  if (result.matchedCount === 0) {
    return res.status(404).send({ message: "Employee not found" });
  }

  res.send({
    success: true,
    message: "Employee updated successfully",
    result
  });
});
// delete employee
app.delete("/employees/:id", async (req, res) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ message: "Invalid employee id" });
  }

  const employee = await employees.findOne({ _id: new ObjectId(id) });

  if (!employee) {
    return res.status(404).send({ message: "Employee not found" });
  }

  // 🔥 delete employee
  await employees.deleteOne({ _id: new ObjectId(id) });

  // 🔥 cleanup related data
  await attendance.deleteMany({ employeeId: new ObjectId(id) });
  await advances.deleteMany({ employeeId: new ObjectId(id) });

  res.send({
    success: true,
    message: "Employee deleted successfully"
  });
});






  /* ================= ATTENDANCE ================= */

  app.post("/attendance", async (req, res) => {
    const { employeeId, date, status } = req.body;

    const filter = {
      employeeId: new ObjectId(employeeId),
      date
    };

    const exists = await attendance.findOne(filter);

    if (exists) {
      await attendance.updateOne(filter, { $set: { status } });
      return res.send({ updated: true });
    }

    const result = await attendance.insertOne({
      employeeId: new ObjectId(employeeId),
      date,
      status
    });

    res.send(result);
  });

  app.get("/attendance/date/:date", async (req, res) => {
    const result = await attendance.find({ date: req.params.date }).toArray();
    res.send(result);
  });

  /* ================= ADVANCE ================= */


/**
 * 🔹 GET advance by DATE
 * Used to:
 * - show existing advance in frontend
 * - decide Save vs Update button
 */
// 🔹 DAILY ATTENDANCE ADVANCE (RAW)
app.get("/advance/date/:date", async (req, res) => {
  try {
    const isoDate = new Date(req.params.date)
      .toISOString()
      .slice(0, 10);

    const result = await advances.find({ date: isoDate }).toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: "Failed to load daily advance" });
  }
});

// 🔹 MONTHLY ADVANCE SUMMARY 
// 🔹 MONTHLY REPORT ADVANCE (GROUPED)
app.get("/advance/:employeeId/:month", async (req, res) => {
  const empId = new ObjectId(req.params.employeeId);
  const month = req.params.month;

  const result = await advances.aggregate([
    {
      $match: {
        employeeId: empId,
        date: { $regex: `^${month}` }
      }
    },
    {
      $group: {
        _id: "$date",
        totalAmount: { $sum: "$amount" }
      }
    },
    { $sort: { _id: 1 } }
  ]).toArray();

  res.send(
    result.map(r => ({
      date: r._id,
      amount: r.totalAmount
    }))
  );
});


/**
 * 🔹 POST advance (CREATE ONLY)
 * ❌ Will NOT create if already exists
 */
app.post("/advance", async (req, res) => {
  try {
    const { employeeId, amount, date } = req.body;

    if (!employeeId || !date) {
      return res.status(400).send({ message: "Invalid data" });
    }

    const isoDate = new Date(date).toISOString().slice(0, 10);

    const exists = await advances.findOne({
      employeeId: new ObjectId(employeeId),
      date: isoDate
    });

    // ❌ Prevent duplicate
    if (exists) {
      return res.status(409).send({
        message: "Advance already exists for this date"
      });
    }

    const result = await advances.insertOne({
      employeeId: new ObjectId(employeeId),
      amount: Number(amount),
      date: isoDate,
      createdAt: new Date()
    });

    res.send({
      success: true,
      message: "Advance created",
      result
    });
  } catch (err) {
    res.status(500).send({ message: "Failed to create advance" });
  }
});


/**
 * 🔹 PATCH advance (UPDATE ONLY)
 * ✔ Used when advance already exists
 */
app.patch("/advance", async (req, res) => {
  try {
    const { employeeId, amount, date } = req.body;

    if (!employeeId || !date) {
      return res.status(400).send({ message: "Invalid data" });
    }

    const isoDate = new Date(date).toISOString().slice(0, 10);

    const result = await advances.updateOne(
      {
        employeeId: new ObjectId(employeeId),
        date: isoDate
      },
      {
        $set: {
          amount: Number(amount),
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({
        message: "Advance not found for update"
      });
    }

    res.send({
      success: true,
      message: "Advance updated"
    });
  } catch (err) {
    res.status(500).send({ message: "Failed to update advance" });
  }
});


  /* ================= SALARY ================= */

  app.get("/salary/:employeeId/:month", async (req, res) => {
    const empId = new ObjectId(req.params.employeeId);
    const month = req.params.month;

    const employee = await employees.findOne({ _id: empId });
    if (!employee) return res.status(404).send({ message: "Employee not found" });

    const presentDays = await attendance.countDocuments({
      employeeId: empId,
      status: "present",
      date: { $regex: `^${month}` }
    });

    const advanceList = await advances.find({
      employeeId: empId,
      date: { $regex: `^${month}` }
    }).toArray();

    const totalAdvance = advanceList.reduce((s, a) => s + a.amount, 0);
    const totalSalary = presentDays * employee.dailySalary;

    res.send({
      employeeName: employee.name,
      presentDays,
      dailySalary: employee.dailySalary,
      totalSalary,
      totalAdvance,
      payable: totalSalary - totalAdvance
    });
  });

  /* ================= CUSTOMERS ================= */

  app.post("/customers", async (req, res) => {
    const { name } = req.body;

    if (!name) {
      return res.status(400).send({ message: "Customer name required" });
    }

    // ✅ PREVENT DUPLICATE
    const exists = await customers.findOne({
      name: { $regex: `^${name}$`, $options: "i" }
    });

    if (exists) {
      return res.status(409).send({ message: "Customer already exists" });
    }

    const result = await customers.insertOne({
      name,
      createdAt: new Date()
    });

    res.send({
      success: true,
      message: "Customer added successfully",
      result
    });
  });

  app.get("/customers", async (req, res) => {
    const result = await customers.find().sort({ createdAt: -1 }).toArray();
    res.send(result);
  });

  app.delete("/customers/:id", async (req, res) => {
    const { id } = req.params;

    const customer = await customers.findOne({ _id: new ObjectId(id) });
    if (!customer) {
      return res.status(404).send({ message: "Customer not found" });
    }

    await customers.deleteOne({ _id: new ObjectId(id) });

    // 🔥 remove from sellingRate
    await sellingRate.updateMany(
      {},
      { $pull: { rates: { customerName: customer.name } } }
    );

    res.send({ success: true });
  });

  /* ================= SELLING RATE ================= */

  app.post("/sellingRate", async (req, res) => {
    const { date, rates, createdAt } = req.body;

    const result = await sellingRate.updateOne(
      { date },
      {
        $set: { date, createdAt },
        $push: { rates: { $each: rates } }
      },
      { upsert: true }
    );

    res.send(result);
  });

  app.get("/sellingRate", async (req, res) => {
    const date = req.query.date || new Date().toISOString().split("T")[0];
    const doc = await sellingRate.findOne({ date });

    res.send({
      date,
      rates: doc?.rates || []
    });
  });

  app.patch("/sellingRate", async (req, res) => {
    const { date, customerName, proposalPrice, actualSellingPrice, piece } = req.body;

    const update = {};
    if (proposalPrice) update["rates.$.proposalPrice"] = proposalPrice;
    if (actualSellingPrice) update["rates.$.actualSellingPrice"] = actualSellingPrice;
    if (piece) {
      update["rates.$.piece"] = {
        boilerBig: Number(piece.boilerBig || 0),
        boilerSmall: Number(piece.boilerSmall || 0)
      };
    }

    const result = await sellingRate.updateOne(
      { date, "rates.customerName": customerName },
      { $set: update }
    );

    res.send(result);
  });

  app.delete("/sellingRate/customer", async (req, res) => {
    const { date, customerName } = req.body;

    const result = await sellingRate.updateOne(
      { date },
      { $pull: { rates: { customerName } } }
    );

    res.send(result);
  });

  app.delete("/sellingRate/date", async (req, res) => {
    const { date } = req.body;
    const result = await sellingRate.deleteOne({ date });
    res.send(result);
  });
};
