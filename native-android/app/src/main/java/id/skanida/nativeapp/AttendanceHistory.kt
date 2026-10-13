package id.skanida.nativeapp

import org.json.JSONObject

// Preserve the calendar's status precedence and its per-date check-in/check-out merge.
fun attendanceHistory(attendances: List<JSONObject>, permits: List<JSONObject>): List<JSONObject> {
    val days = linkedMapOf<String, JSONObject>()
    attendances.groupBy { it.text("date").substringBefore('T') }.forEach { (date, records) ->
        val checkIn = records.firstOrNull { it.text("status") in listOf("Hadir", "Terlambat", "present", "late") }
        val checkOut = records.firstOrNull { it.text("status") in listOf("Pulang", "home") || it.text("action_type") == "check_out" }
        val status = when {
            records.any { it.text("status") in listOf("Alpha", "absent") } -> "absent"
            records.any { it.text("status") == "sick" } -> "sick"
            records.any { it.text("status") == "leave" } -> "leave"
            records.any { it.text("status") in listOf("Terlambat", "late") } -> "late"
            checkIn != null || checkOut != null -> "present"
            else -> return@forEach
        }
        days[date] = json("date" to date, "status" to status, "check_in_time" to checkIn?.text("created_at"), "check_out_time" to checkOut?.text("created_at"))
    }
    permits.filter { it.text("approval_status") != "rejected" }.forEach { permit ->
        val date = permit.text("date").substringBefore('T')
        days[date] = json("date" to date, "status" to if (permit.text("category") == "sakit") "sick" else "leave",
            "description" to permit.text("description"), "category" to permit.text("category"), "approval_status" to permit.text("approval_status"))
    }
    return days.values.sortedByDescending { it.text("date") }
}
