import sys
import json

def asignar_domiciliario(datos):
    """Lógica para asignar de forma inteligente al repartidor idóneo"""
    id_pedido = datos.get("id_pedido")
    domiciliarios = datos.get("domiciliarios", [])
    
    if not domiciliarios:
        return {"status": "error", "mensaje": "No hay repartidores disponibles en Maicao."}
    
    # Algoritmo: Selecciona al repartidor disponible (por ejemplo, el primero de la lista)
    elegido = domiciliarios[0]
    
    return {
        "status": "exitoso",
        "accion": "asignar",
        "id_pedido": id_pedido,
        "id_domiciliario": elegido["id_domiciliario"],
        "nombre": elegido["nombre"]
    }

def generar_reporte_ventas(datos):
    """Lógica para procesar estadísticas de ventas de una empresa"""
    id_empresa = datos.get("id_empresa")
    historial_pedidos = datos.get("historial", [])
    
    total_ingresos = 0
    pedidos_completados = 0
    
    for pedido in historial_pedidos:
        if pedido["estado"] == "Entregado":
            total_ingresos += float(pedido["total"])
            pedidos_completados += 1
            
    return {
        "status": "exitoso",
        "accion": "reporte",
        "id_empresa": id_empresa,
        "total_ingresos": total_ingresos,
        "pedidos_entregados": pedidos_completados,
        "rendimiento": "Alto" if pedidos_completados > 5 else "Estable"
    }

if __name__ == "__main__":
    # Leer el JSON enviado desde Node.js
    input_data = sys.stdin.read()
    if input_data:
        peticion = json.loads(input_data)
        tipo_tarea = peticion.get("tarea")
        datos_tarea = peticion.get("datos")
        
        # Evaluar qué tarea ejecutar
        if tipo_tarea == "asignar_repartidor":
            resultado = asignar_domiciliario(datos_tarea)
        elif tipo_tarea == "reporte_ventas":
            resultado = generar_reporte_ventas(datos_tarea)
        else:
            resultado = {"status": "error", "mensaje": "Tarea no reconocida por el módulo de Python."}
            
        # Devolver el resultado a Node.js en formato JSON
        print(json.dumps(resultado))