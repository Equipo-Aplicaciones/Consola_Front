import { useCallback,useEffect, useState } from "react";
import { Badge } from "react-bootstrap";
import TaskModal from "./TaskModal";
import TaskResultsModal from "./TaskResultsModal";
import { API_BASE_URL } from "../../config";
import MobileActions from "../utils/MobileActions";


function ScheduledTasks({token}) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editTask, setEditTask] = useState(null);

  const [showResults, setShowResults] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  const [runningTaskId, setRunningTaskId] = useState(null);
  const [runningType, setRunningType] = useState(null); // "run" | "retry"
  const [progress, setProgress] = useState(0);
  

   const cargarTareas = useCallback( async () => { 
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/scheduled-tasks/tareas`,{
          method:"GET",
          headers:{
            Authorization:`Bearer ${token}`,
            "Content-Type": "application/json" }          
        }
      );

      if(!res.ok){
        throw new Error("Error cargando tareas");
      }
      const data = await res.json();
      setTasks(data);
    } catch(err){
      console.error("❌ Error:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(()=>{
    cargarTareas();
  },[cargarTareas]);


  const ejecutarTarea = async(id)=>{
    setRunningTaskId(id);
    setRunningType("run");
    setProgress(0);

    try{
      const res = await fetch(
        `${API_BASE_URL}/scheduled-tasks/${id}/run`,
        {
          method:"POST",
          headers:{
            Authorization:`Bearer ${token}`,
            "Content-Type": "application/json" }          
        }
      );

      if(!res.ok){
        throw new Error("Error ejecutando tarea");
      }
      alert("✅ Tarea ejecutada correctamente");
      setRunningTaskId(null);
      setRunningType(null);
      setProgress(0);
      cargarTareas();

    }catch(err){
      console.error(err);
      alert("❌ Error ejecutando tarea");
    }
  };


  const reintentar = async(id)=>{
    setRunningTaskId(id);
    setRunningType("run");
    setProgress(0);
    try{
      const res = await fetch(`${API_BASE_URL}/scheduled-tasks/${id}/retry`,{
          method:"POST",
          headers:{
            Authorization:`Bearer ${token}`
          }
        }
      );

      if(!res.ok){
        throw new Error("Error reintentando tarea");
      }
      alert("✅ Reintento ejecutado");
      setRunningTaskId(null);
      setRunningType(null);
      setProgress(0);
      cargarTareas();

    }catch(err){
      console.error(err);
      alert("❌ Error en reintento");
    }
  };

  const toggleActivo = async (id, campo, value) => {
    if (!window.confirm("¿Seguro de cambiar el estado de la tarea?")) return;
    console.log(id,campo,value);
    
    await fetch(`${API_BASE_URL}/scheduled-tasks/estado/${id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ [campo]: value }),
    });

    cargarTareas();
  };

  const obtenerDia = (dia) => {
    const dias = {
      1: "Lunes",
      2: "Martes",
      3: "Miércoles",
      4: "Jueves",
      5: "Viernes",
      6: "Sábado",
      7: "Domingo"
    };

    return dias[dia] || "-";
  };
 

  return (
    <div className="card shadow-sm">
      <div className="card-header d-flex justify-content-between align-items-center gap-2 px-2">
        <h4>Tareas Programadas</h4>
        <button className="btn btn-sm btn-success m-0" onClick={()=>{
            setEditTask(null);
            setShowModal(true);
          }} >➕ Tarea</button>
      </div>
      <div className="card-body p-0">
        { loading ?
          <div> Cargando... </div>
          :
            <div style={{ minHeight: 350, overflowY: "auto",maxHeight: 500 }}>
              <table className="table table-hover table-sm mb-0">
                <thead className="sticky-top bg-white shadow-sm">
                  <tr className="table-secondary ">
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Activar</th>
                  <th>Desactivar</th>
                  <th className="text-center">Estado</th>
                  <th className="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
              {
                tasks.map(task=>(
                  <tr key={task.id}>
                    <td>{task.nombre}</td>
                    <td>
                      {
                        task.tipo_accion === "VACIAR_TABLA" ?
                        <Badge bg="warning" text="dark">Vaciar tabla</Badge>
                        : task.tipo_accion === "OTRO" ?
                        <Badge bg="dark">Otros</Badge>
                        :
                        <Badge bg="secondary">Artículos</Badge>
                      }
                    </td>
                    <td>{obtenerDia(task.dia_activar)}</td>
                    <td>{obtenerDia(task.dia_desactivar)}</td>
                    <td className="text-center">
                      {
                        task.tipo_accion === "VACIAR_TABLA" ?
                        "-"
                        :
                        (
                          task.visible ?
                          <Badge bg="success">Visible</Badge>
                          :
                          <Badge bg="danger">Invisible</Badge>
                        )
                      }
                    </td>
                    
                    <td className="text-center">
                      <div className="d-flex justify-content-center align-items-center">
                        <div className="d-none d-md-flex gap-2">
                          {task.tipo_accion !== "OTRO" && (
                            <button size="sm" className="btn btn-sm btn-primary me-1" title="Ejecutar tarea"
                              onClick={()=>ejecutarTarea(task.id)} disabled={runningTaskId === task.id} >
                                {runningTaskId === task.id && runningType === "run" ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status"/>
                                        Ejecutando...
                                    </>
                                ) : (
                                    <i className="bi bi-play-fill"></i>
                                )}
                              </button>
                          )}
                          <button size="sm" className="btn btn-sm btn-secondary me-1" title="Editar tarea" onClick={()=>{
                            setEditTask(task);
                            setShowModal(true);
                          }}>✏️</button>
                          <button size="sm" className="btn btn-sm btn-info me-1" title="Ver resultados" onClick={()=>{
                            setSelectedTask(task);
                            setShowResults(true);
                          }}>📋</button>
                          {task.tipo_accion !== "OTRO" && (
                            <button size="sm" className="btn btn-sm btn-danger me-1" title="Reintentar tarea"
                            onClick={()=>reintentar(task.id)} disabled={runningTaskId === task.id}>
                              {runningTaskId === task.id && runningType === "retry" ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status"/>
                                        Reintentando...
                                    </>
                                ) : (
                                    <i className="bi bi-arrow-clockwise"></i>
                                )}

                              </button>
                          )}
                          <button title={task.activo ? "Desactivar Tarea" : "Activar Tarea"}
                                    className={`btn btn-sm ${ task.activo
                                      ? "btn-success "
                                      : "btn-secondary "
                                    }`}
                                    onClick={() => toggleActivo(task.id,"activo", !task.activo)}>
                                        {task.activo ? "⏻" : "⏻"}
                                    </button>
                          </div>
                          <MobileActions
                            actions={[
                              ...(task.tipo_accion !== "OTRO" ? [{
                                label: "Ejecutar",
                                icon: "bi bi-play-fill",
                                onClick: () => ejecutarTarea(task.id),
                              }] : []),
                              {
                                label: "Editar",
                                icon: "bi bi-pencil",
                                onClick: () => {
                                  setEditTask(task);
                                  setShowModal(true);
                                },
                              },
                              {
                                label: "Ver resultados",
                                icon: "bi bi-list",
                                onClick: () => {
                                  setSelectedTask(task);
                                  setShowResults(true);
                                }
                              },
                              ...(task.tipo_accion !== "OTRO" ? [{
                                label: "Reintentar",
                                icon: "bi bi-arrow-clockwise",
                                onClick: () => reintentar(task.id),
                              }] : []),
                              {
                                label: task.activo ? "Desactivar" : "Activar",
                                icon: task.activo ? "bi bi-toggle-on" : "bi bi-toggle-off",
                                onClick: () => toggleActivo(task.id, "activo", !task.activo),
                              }
                            ]}
                          />
                        </div>
                    </td>
                  </tr>
                ))
              }
              </tbody>
            </table>
          </div>


        }
      </div>

      <TaskModal 
        show={showModal}
        task={editTask}
        onClose={()=>setShowModal(false)}
        refresh={cargarTareas}
        token={token}
      />

      <TaskResultsModal
        show={showResults}
        task={selectedTask}
        onClose={()=>setShowResults(false)}
        token={token}
      />
    </div>
  );
}

export default ScheduledTasks;